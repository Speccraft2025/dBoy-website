const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const pesapalConfig = require("./src/config");
const pesapalApi = require("./src/pesapal");

admin.initializeApp();
const db = getFirestore();

const EXCHANGE_RATE = 130; // 1 USD = 130 KES

// Helper to calculate exact order totals on the server to prevent spoofing
function calculateOrderTotal(items, currency) {
    let subtotal = 0;
    let discount = 0;
    
    const premiumItems = [];
    const otherItems = [];

    const rate = currency === 'KES' ? EXCHANGE_RATE : 1;

    items.forEach(item => {
        // Enforce server-side pricing structure based on tier
        if (item.licenseType === 'basic') item.price = 0;
        else if (item.licenseType === 'premium') item.price = 50 * rate;
        else if (item.licenseType === 'exclusive') item.price = 100 * rate;

        if (item.licenseType === 'premium') premiumItems.push(item);
        else otherItems.push(item);
    });

    otherItems.forEach(item => { subtotal += item.price; });
    premiumItems.sort((a, b) => b.price - a.price);

    for (let i = 0; i < premiumItems.length; i++) {
        subtotal += premiumItems[i].price;
        if (i % 3 === 1 || i % 3 === 2) discount += premiumItems[i].price;
    }

    return subtotal - discount;
}

/**
 * createOrder (Callable via Frontend SDK)
 * Generates the Pesapal Order Link
 */
exports.createOrder = onCall({ 
    cors: true,
    secrets: ["PESAPAL_CONSUMER_KEY", "PESAPAL_CONSUMER_SECRET", "PESAPAL_ENV"]
}, async (request) => {
    try {
        const { items, userEmail, callbackUrl, currency = 'USD' } = request.data;
        const uid = request.auth ? request.auth.uid : 'guest';

        if (!items || items.length === 0) {
            throw new Error("Cart is empty");
        }

        const totalAmount = calculateOrderTotal(items, currency);

        // Track order in Firestore before attempting Pesapal (state: pending)
        const orderRef = db.collection("orders").doc();
        const orderId = orderRef.id;

        await orderRef.set({
            items,
            totalAmount,
            currency: currency,
            status: 'pending',
            userEmail: userEmail || 'guest@example.com',
            userId: uid,
            createdAt: FieldValue.serverTimestamp()
        });

        // 1. Get Auth Token
        const token = await pesapalApi.getAuthToken();

        // 2. Register IPN webhook URL
        // Regional URL required for Firebase Functions v2 (us-central1)
        const ipnUrl = `https://us-central1-dboywebsite.cloudfunctions.net/pesapalIpnCallback`;
        const ipnId = await pesapalApi.registerIPN(token, ipnUrl);

        // 3. Build Pesapal payload
        const pesapalPayload = {
            id: orderId,
            currency: currency,
            amount: totalAmount,
            description: `Beat Licensing x${items.length}`,
            callback_url: callbackUrl,
            notification_id: ipnId,
            billing_address: {
                email_address: userEmail || 'guest@example.com',
                phone_number: "",
                country_code: "KE",
                first_name: "Customer",
                middle_name: "",
                last_name: ""
            }
        };

        // 4. Submit Order Request
        const response = await pesapalApi.submitOrderRequest(token, pesapalPayload);

        // Update tracking ID on order
        await orderRef.update({
            pesapalTrackingId: response.order_tracking_id
        });

        return {
            redirectUrl: response.redirect_url,
            orderId: orderId
        };
    } catch (error) {
        console.error("CreateOrder Error:", error);
        throw new HttpsError("internal", error.message);
    }
});

/**
 * pesapalIpnCallback (Webhook from Pesapal)
 * Triggers when a payment resolves. Validates status directly with Pesapal API.
 */
exports.pesapalIpnCallback = onRequest({
    secrets: ["PESAPAL_CONSUMER_KEY", "PESAPAL_CONSUMER_SECRET", "PESAPAL_ENV"]
}, async (req, res) => {
    try {
        const { OrderTrackingId, OrderNotificationType, MerchantReference } = req.query;

        console.log(`[IPN] Received webhook for Tracking ID: ${OrderTrackingId}`);

        if (!OrderTrackingId) {
            return res.status(400).send("Missing OrderTrackingId");
        }

        // Validate directly from the source to prevent spoofing
        const token = await pesapalApi.getAuthToken();
        const statusResponse = await pesapalApi.getTransactionStatus(token, OrderTrackingId);

        const paymentStatus = statusResponse.payment_status_description;

        // Fetch our existing order
        const orderRef = db.collection("orders").doc(MerchantReference);
        const orderSnap = await orderRef.get();

        if (!orderSnap.exists) {
            console.error(`[IPN] Order not found: ${MerchantReference}`);
            return res.status(404).send("Order not found");
        }

        // Allowed statuses: COMPLETED, FAILED, INVALID
        let localStatus = 'pending';
        if (paymentStatus === 'Completed') localStatus = 'paid';
        if (paymentStatus === 'Failed') localStatus = 'failed';

        // Securely update order
        await orderRef.update({
            status: localStatus,
            pesapalStatusDetail: paymentStatus,
            pesapalRaw: statusResponse,
            updatedAt: FieldValue.serverTimestamp()
        });

        console.log(`[IPN] Order ${MerchantReference} updated to ${localStatus}`);

        // Acknowledge the webhook successfully
        res.status(200).json({
            OrderTrackingId: OrderTrackingId,
            OrderNotificationType: OrderNotificationType,
            OrderMerchantReference: MerchantReference,
            status: 200
        });
    } catch (error) {
        console.error("[IPN] Error:", error);
        res.status(500).send("Internal Server Error");
    }
});

const PDFDocument = require('pdfkit');

function getStoragePathFromUrl(downloadUrl) {
    if (!downloadUrl) return null;
    try {
        const decoded = decodeURIComponent(downloadUrl);
        return decoded.split('/o/')[1].split('?')[0];
    } catch (e) {
        return null; // fallback or failed parse
    }
}

/**
 * getOrderedAssets (Callable)
 * Generates secure, short-lived signed URLs for paid orders and custom PDFs.
 */
exports.getOrderedAssets = onCall({ 
    cors: true, 
    secrets: ["PESAPAL_CONSUMER_KEY", "PESAPAL_CONSUMER_SECRET", "PESAPAL_ENV"]
}, async (request) => {
    try {
        const { orderId, userEmail } = request.data;
        
        if (!orderId) throw new Error("Missing orderId");

        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();

        if (!orderSnap.exists) throw new Error("Order not found");

        const orderData = orderSnap.data();

        // Security check
        if (orderData.status !== 'paid') throw new Error("Order is not marked as paid");
        
        const uid = request.auth ? request.auth.uid : null;
        if (orderData.userEmail !== userEmail && orderData.userId !== uid) {
            throw new Error("Unauthorized access to this order");
        }

        const bucket = admin.storage().bucket();
        const assets = [];

        // Generate Assets per item
        for (const item of orderData.items) {
            // 1. Fetch exact beat document to get uploaded URL references
            if (!item.beatId) {
                console.warn(`Item in order ${orderId} missing beatId. Skipping file retrieval for this item.`);
                continue;
            }
            
            const beatSnap = await db.collection("beats").doc(item.beatId).get();
            const beatData = beatSnap.exists ? beatSnap.data() : null;
            
            // Determine the target URL based on license type
            let targetDownloadUrl = null;
            let secondaryUrl = null;
            
            if (beatData) {
                if (item.licenseType === 'basic') {
                    // Standard stream MP3
                    targetDownloadUrl = beatData.audioUrl;
                } else if (item.licenseType === 'premium') {
                    // High quality untagged
                    targetDownloadUrl = beatData.untaggedUrl || beatData.audioUrl;
                } else if (item.licenseType === 'exclusive') {
                    // Untagged + Stems
                    targetDownloadUrl = beatData.untaggedUrl || beatData.audioUrl;
                    secondaryUrl = beatData.stemsUrl;
                }
            }

            const filesToSign = [];
            
            if (targetDownloadUrl) {
                const p = getStoragePathFromUrl(targetDownloadUrl);
                if (p) filesToSign.push({ path: p, type: 'audio' });
            }
            if (secondaryUrl) {
                const p = getStoragePathFromUrl(secondaryUrl);
                if (p) filesToSign.push({ path: p, type: 'stems' });
            }

            const itemUrls = [];

            for (const f of filesToSign) {
                try {
                    const file = bucket.file(f.path);
                    const [exists] = await file.exists();
                    if (exists) {
                        const [url] = await file.getSignedUrl({
                            version: 'v4', action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days
                        });
                        itemUrls.push({ type: f.type, url });
                    }
                } catch (e) { console.error("Sign error:", e); }
            }

            // 2. Dynamic PDF License Generator
            let licensePdfUrl = null;
            try {
                const pdfBuffer = await new Promise((resolve, reject) => {
                    const doc = new PDFDocument({ margin: 50 });
                    const chunks = [];
                    doc.on('data', chunk => chunks.push(chunk));
                    doc.on('end', () => resolve(Buffer.concat(chunks)));
                    doc.on('error', reject);

                    // Build PDF
                    doc.fontSize(24).font('Helvetica-Bold').text('BEAT LICENSE AGREEMENT', { align: 'center' });
                    doc.moveDown();
                    doc.fontSize(12).font('Helvetica').text(`Order ID: ${orderId}`);
                    doc.text(`Date: ${new Date().toLocaleDateString()}`);
                    doc.text(`Licensee (Buyer Email): ${userEmail}`);
                    doc.moveDown();
                    doc.fontSize(16).font('Helvetica-Bold').text(`Beat Title: ${item.title}`);
                    doc.fontSize(14).text(`License Tier: ${item.licenseType.toUpperCase()}`);
                    doc.moveDown();
                    
                    doc.fontSize(11).font('Helvetica').text('By purchasing this license, the Licensee agrees to the following terms:');
                    doc.moveDown(0.5);
                    
                    if (item.licenseType === 'basic') {
                        doc.text('• Non-Exclusive MP3 Distribution Rights.\n• Up to 50,000 Audio Streams.\n• Required Credit: "Prod. by Jazel \'dBoy\' Isaac".');
                    } else if (item.licenseType === 'premium') {
                        doc.text('• High-Quality Untagged WAV.\n• Up to 500,000 Audio Streams.\n• Commercial Use Allowed.\n• Required Credit: "Prod. by Jazel \'dBoy\' Isaac".');
                    } else if (item.licenseType === 'exclusive') {
                        doc.text('• Unlimited Commercial Rights & Track Stems.\n• Ownership transferred to Licensee.\n• Must remove beat from public marketplace.\n• Required Co-Producer Credit: "Prod. by Jazel \'dBoy\' Isaac".');
                    }
                    doc.end();
                });

                const pdfFile = bucket.file(`licenses/orders/${orderId}_${item.beatId}.pdf`);
                await pdfFile.save(pdfBuffer, { contentType: 'application/pdf' });
                
                const [url] = await pdfFile.getSignedUrl({
                    version: 'v4', action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 7
                });
                licensePdfUrl = url;

            } catch (err) {
                console.error("PDF Gen Error:", err);
            }

            assets.push({
                title: item.title,
                licenseType: item.licenseType,
                audioUrl: itemUrls.find(i => i.type === 'audio')?.url,
                stemsUrl: itemUrls.find(i => i.type === 'stems')?.url,
                licensePdfUrl: licensePdfUrl
            });
        }

        return { assets };
    } catch (error) {
        console.error("getOrderedAssets Error:", error);
        throw new HttpsError("internal", error.message);
    }
});

/**
 * findAndFixOrders (Temporary Maintenance)
 * Finds the specific beat by title and patches the 'Recovered' orders.
 */
exports.findAndFixOrders = onCall({ cors: true }, async (request) => {
    try {
        // 1. Find the actual beat ID by Title
        const beatsSnap = await db.collection('beats')
            .where('title', '==', 'AFRO-LATIN-DANCEHALL_2_BEAT')
            .limit(1)
            .get();
        
        if (beatsSnap.empty) {
             // Fallback: search case-insensitive or partial if needed, but let's try exact first
             throw new Error("Could not find beat with title 'AFRO-LATIN-DANCEHALL_2_BEAT'");
        }
        
        const beatDoc = beatsSnap.docs[0];
        const beatId = beatDoc.id;
        const beatData = beatDoc.data();

        // 2. List of Order IDs to fix
        const orderIds = [
            'ZZUBvWM49Ujfz1tsHu5H',
            '7ebnMNcgopPUDdM2F75K',
            'Pt90X7tm06NsQjGPMN2n',
            '3XY0xa3FDodHVnQt8AO5'
        ];

        const batch = db.batch();
        for (const id of orderIds) {
            batch.set(db.collection('orders').doc(id), {
                items: [{
                    beatId: beatId,
                    title: beatData.title,
                    price: 50,
                    licenseType: 'premium'
                }],
                updatedAt: FieldValue.serverTimestamp(),
                status: 'paid'
            }, { merge: true });
        }
        
        await batch.commit();

        return { success: true, message: `Linked 4 orders to beat ${beatId} (${beatData.title})` };
    } catch (error) {
        throw new HttpsError('internal', error.message);
    }
});
