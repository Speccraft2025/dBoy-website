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
    
    const starterItems = [];
    const standardItems = [];

    const rate = currency === 'KES' ? 1 : (1 / EXCHANGE_RATE);

    items.forEach(item => {
        // Enforce server-side pricing structure based on tier (Base KES)
        if (item.licenseType === 'starter') item.price = 1000;
        else if (item.licenseType === 'standard') item.price = 4000;
        else if (item.licenseType === 'custom') item.price = 10000;
        else item.price = 1000;

        if (item.isExclusive) {
            item.price = 10000;
            subtotal += item.price;
        } else {
            subtotal += item.price;
            if (item.licenseType === 'starter') starterItems.push(item);
            if (item.licenseType === 'standard') standardItems.push(item);
        }
    });

    starterItems.sort((a, b) => b.price - a.price);
    let starterFreeCount = Math.floor(starterItems.length / 5) * 2 + Math.floor((starterItems.length % 5) / 2);
    for (let i = 0; i < starterFreeCount; i++) {
        discount += starterItems[starterItems.length - 1 - i].price;
    }

    standardItems.sort((a, b) => b.price - a.price);
    let standardFreeCount = Math.floor(standardItems.length / 3);
    for (let i = 0; i < standardFreeCount; i++) {
        discount += standardItems[standardItems.length - 1 - i].price;
    }

    const finalSubtotal = Math.round(subtotal * rate);
    const finalDiscount = Math.round(discount * rate);
    return finalSubtotal - finalDiscount;
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

        if (!response || !response.order_tracking_id) {
            console.error("Pesapal Submit Error Response:", response);
            throw new Error(`Pesapal rejected the order: ${response?.error?.message || response?.message || JSON.stringify(response)}`);
        }

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
        const OrderTrackingId = req.query.OrderTrackingId || req.body?.OrderTrackingId;
        const OrderNotificationType = req.query.OrderNotificationType || req.body?.OrderNotificationType;
        const MerchantReference = req.query.OrderMerchantReference || req.body?.OrderMerchantReference || req.query.MerchantReference;

        console.log(`[IPN] Received webhook for Tracking ID: ${OrderTrackingId}, Ref: ${MerchantReference}`);

        if (!OrderTrackingId) {
            return res.status(400).send("Missing OrderTrackingId");
        }
        if (!MerchantReference) {
            return res.status(400).send("Missing MerchantReference");
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

        const orderData = orderSnap.data();

        // Securely update order
        await orderRef.update({
            status: localStatus,
            pesapalStatusDetail: paymentStatus,
            pesapalRaw: statusResponse,
            updatedAt: FieldValue.serverTimestamp()
        });

        // If newly paid, check for exclusive items to remove from store
        if (localStatus === 'paid' && orderData.status !== 'paid' && orderData.items) {
            const exclusiveItems = orderData.items.filter(i => i.isExclusive);
            if (exclusiveItems.length > 0) {
                const batch = db.batch();
                exclusiveItems.forEach(item => {
                    if (item.beatId) {
                        batch.update(db.collection('beats').doc(item.beatId), { isAvailable: false });
                    }
                });
                await batch.commit().catch(e => console.error("[IPN] Error making beats unavailable:", e));
            }
        }

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
                if (item.isExclusive || item.licenseType === 'custom') {
                    // Untagged + Stems
                    targetDownloadUrl = beatData.untaggedUrl || beatData.audioUrl;
                    secondaryUrl = beatData.stemsUrl;
                } else if (item.licenseType === 'standard') {
                    // High quality untagged
                    targetDownloadUrl = beatData.untaggedUrl || beatData.audioUrl;
                } else if (item.licenseType === 'starter') {
                    // Standard stream MP3
                    targetDownloadUrl = beatData.audioUrl;
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
                    
                    if (item.isExclusive) {
                        doc.text('• Full rights granted to Licensee.\n• Beat is removed from all future sales.\n• Unlimited streams and monetization.\n• Rights are non-transferable.');
                    } else if (item.licenseType === 'starter') {
                        doc.text('• Non-exclusive license (MP3 format only).\n• Limited to 5,000 streams.\n• Not permitted for monetized distribution.\n• Credit required: "Prod. by Jazel \'dBoy\' Isaac".');
                    } else if (item.licenseType === 'standard') {
                        doc.text('• Non-exclusive license (MP3 + WAV files).\n• Up to 100,000 streams & Monetization allowed.\n• One (1) music video & Live performances permitted.\n• Credit required: "Prod. by Jazel \'dBoy\' Isaac".');
                    } else if (item.licenseType === 'custom') {
                        doc.text('• Non-exclusive by default (MP3 + WAV + Stems).\n• Up to 250,000 streams & Monetization allowed.\n• Includes agreed revisions.\n• Credit required: "Prod. by Jazel \'dBoy\' Isaac".');
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
 * Rescues a specific stuck order by manually checking Pesapal status
 */
exports.findAndFixOrders = onCall({ 
    cors: true,
    secrets: ["PESAPAL_CONSUMER_KEY", "PESAPAL_CONSUMER_SECRET", "PESAPAL_ENV"]
}, async (request) => {
    try {
        const orderId = 'Wd3fCrjqvYH2DAANMXtu';
        const trackingId = '593403ce-5df8-42d4-a90b-da76daa7a8e8';

        const token = await pesapalApi.getAuthToken();
        const statusResponse = await pesapalApi.getTransactionStatus(token, trackingId);
        const paymentStatus = statusResponse.payment_status_description;

        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) throw new Error("Order not found");
        
        let localStatus = 'pending';
        if (paymentStatus === 'Completed') localStatus = 'paid';
        if (paymentStatus === 'Failed') localStatus = 'failed';

        const orderData = orderSnap.data();

        await orderRef.update({
            status: localStatus,
            pesapalStatusDetail: paymentStatus,
            pesapalRaw: statusResponse,
            updatedAt: FieldValue.serverTimestamp()
        });

        // If newly paid, check for exclusive items to remove from store
        if (localStatus === 'paid' && orderData.status !== 'paid' && orderData.items) {
            const exclusiveItems = orderData.items.filter(i => i.isExclusive);
            if (exclusiveItems.length > 0) {
                const batch = db.batch();
                exclusiveItems.forEach(item => {
                    if (item.beatId) {
                        batch.update(db.collection('beats').doc(item.beatId), { isAvailable: false });
                    }
                });
                await batch.commit();
            }
        }

        return { success: true, message: `Order ${orderId} synced. Status: ${localStatus}` };
    } catch (error) {
        throw new HttpsError('internal', error.message);
    }
});
