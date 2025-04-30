const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");

const Transaction = require("../../models/transactionSchema");
const puppeteer = require('puppeteer');
const Razorpay = require('razorpay');
const generateHTMLContent=require("../utils/generateReport")
const pdfMake = require('pdfmake'); 
const PDFDocument = require('pdfkit');
const fs = require('fs-extra')
const { Parser } = require('json2csv');


const getOrders = async (req, res) => {
    
    try {
        console.log("Fetching orders...");
    
        const orders = await Order.aggregate([
            {
                $lookup: {
                    from: "products", // Collection name for the products
                    localField: "orderItems.product", // Field in 'Order' document
                    foreignField: "_id", // Field in 'Product' document
                    as: "orderItems.productDetails" // Field to store the product data
                }
            },
            {
                $unwind: "$orderItems" // Flatten the orderItems array
            },
            {
                $unwind: "$orderItems.productDetails" // Flatten the productDetails array
            },
            {
                $project: {
                    orderId: 1,
                    createdOn: 1,
                    finalAmount: 1,
                    status: 1,
                    address: 1,
                    "orderItems.product": "$orderItems.productDetails.productName", // Extract product name
                    "orderItems.productImage": "$orderItems.productDetails.productImage", // Extract product image
                    "orderItems.price": "$orderItems.productDetails.price", // Extract product price
                    "orderItems.quantity": "$orderItems.quantity" ,// Keep quantity from the order
                    returnStatus:1,
                    cancelReason:1,
                    returnReason:1
                }
            },
            {
                $sort: { createdOn: -1 } // Sort by created date in descending order
            }
        ]);
    
        console.log(orders); // Check the structure of the data
    
        res.render("admin-orders", {
            orders,
            title: "Order Management",
        });
    } catch (error) {
        console.error("Error fetching orders:", error.message);
        res.status(500).send("Internal Server Error");
    }
}

const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        console.log("Order ID:", orderId);  // Log the orderId to check
        const order = await Order.findOne({ orderId: orderId })
        .populate({
          path: "orderItems.product",
          select: "productName productImage price quantity",
        });
        

          
        if (!order) {
            return res.status(404).send("Order not found");
        }
        res.render("admin-orders-details", {
            order,
            title: "Order Details",
        });
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).send("Internal Server Error");
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const order = await Order.findById(orderId);
console.log("orer order =",order)
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Don't allow status change if order is cancelled
        if (order.status === 'cancelled') {
            return res.status(400).json({ success: false, message: "Cannot update cancelled order" });
        }

        // Update order status
        order.status = status;
        order.orderItems[0].status = status;

        await order.save();
        res.json({ success: true, message: "Order status updated successfully" });
    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const orderCancelled = async (req, res) => {
    try {
      const { orderId } = req.body;
      const order = await Order.findById(orderId);
  
      // Check if the order exists
      if (!order) {
        return res.json({ success: false, message: `Cannot find the order` });
      }
  
      // Check if the order is already cancelled
      if (order.status === 'cancelled') {
        return res.json({ success: false, message: `Order already cancelled` });
      }
  
      // Loop through all order items to restock each product
      await Promise.all(order.orderItems.map(async (item) => {
        const product = await Product.findById(item.product); // Ensure we're using the correct product
        if (!product) {
          console.log(`Product not found for productId: ${item.product}`);
          return;
        }
  
        // Calculate the new product quantity
        product.quantity += item.quantity; // Add the quantity of the canceled order item to the stock
        await product.save();
      }));
  
      // Mark the order as cancelled and save
      order.status = 'cancelled';
      await order.save();
  
      return res.json({ success: true, message: 'Order cancelled successfully' });
  
    } catch (error) {
      console.error('Error occurred while cancelling the order', error);
      return res.status(500).send('Internal Server Error');
    }
  };
  
  
const cancelOrder = async (req, res) => {
    try {
        const { orderId, reason } = req.body;
        console.log("orderId = ", orderId);
        console.log("reason =", reason);
        const userId = req.session.user;

        // Fetch the order details using the orderId directly (no need to convert to ObjectId if it's UUID)
        const order = await Order.findOne({ orderId: orderId, userId: userId });

        // Check if order exists
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // If the order is neither cancelled nor delivered, cancel it
        if (order.status !== 'cancelled' && order.status !== 'delivered') {
            // Update the order status to 'cancelled' and apply the cancellation reason to the items
            const updateOrder = await Order.updateOne(
                { orderId: orderId, userId: userId }, // No need to convert orderId here
                {
                    $set: {
                        status: 'cancelled',
                        cancelReason: reason,
                        'orderItems.$[].status': 'cancelled',  // Using $[] to update all items in the array
                        'orderItems.$[].cancelReason': reason  // Apply reason to all items
                    },
                    $inc: { 
                        'orderItems.$[].quantity': 1 // Restock all items
                    }
                }
            );

            // Loop through each order item and update product stock
            await Promise.all(order.orderItems.map(async (item) => {
                await Product.findByIdAndUpdate(item.product, {
                    $inc: { quantity: item.quantity } // Increase stock by item quantity
                });
            }));

            return res.json({ success: true, message: 'Order cancelled successfully' });
        } else {
            return res.status(400).json({ success: false, message: 'Order cannot be cancelled' });
        }

    } catch (error) {
        console.error('Error in cancelOrder:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


const approveRefund = async (req, res) => {
    try {
        const { orderId } = req.body;

        // Find the order by ID
        const order = await Order.findById(orderId).populate('userId');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Check if the order's return status is "requested" and it's not already refunded
        if (order.returnStatus !== 'requested') {
            return res.status(400).json({ success: false, message: 'Refund not requested or already processed' });
        }

        // Change the order's return status to 'approved'
        order.returnStatus = 'approved';
        order.isReturnAuthorized = true;
order.status='returned'
        // Check if refund method is 'wallet', and if so, refund to user's wallet
        if (order.refundMethod === 'wallet') {
            // Update the user's wallet balance
            const user = await User.findById(order.userId);
            user.wallet += order.finalAmount; // Add the refund amount to the wallet
            await user.save();

            // Log this transaction for wallet refund
            const transaction = new Transaction({
                userId: user._id,
                amount: order.finalAmount,
                transactionType: 'Refund',
                status: 'Success',
                description: `Refund for Order ID: ${orderId}`
            });
            await transaction.save();
        }

        // You can also handle other refund methods like Razorpay here, if needed

        // Save the order with updated return status
        await order.save();

        res.json({ success: true, message: 'Refund approved successfully' });

    } catch (error) {
        console.error('Error approving refund:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};


const rejectRefund = async (req, res) => {
    try {
        const {  orderId, itemId, adminMessage } = req.body;

        // 1. Find the order by ID
        const order = await Order.findById(orderId).populate('userId');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // 2. Check if refund was actually requested
        if (order.returnStatus !== 'requested') {
            return res.status(400).json({ success: false, message: 'Refund not requested or already processed' });
        }

        // 3. Reject the return
        order.returnStatus = 'rejected';
        order.orderItems.forEach(item => {
            item.requestStatus = 'rejected';
        });
        
        order.returnReason= adminMessage;

        // 4. Save the updated order
        await order.save();

        // 5. Send success response
        res.json({ success: true, message: 'Refund rejected. Product cannot be returned.' });

    } catch (error) {
        console.error('Error rejecting refund:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const getReports = async (req, res) => {
    try {
        console.log("It came here");
        console.log("query = ", req.query.download);
        
        // Get date range from query parameters
        let { startDate, endDate, reportType } = req.query;

        // Function to normalize date to UTC start and end times
        const normalizeDateToUTC = (date, setTime = 'start') => {
            const normalizedDate = new Date(date);
            if (setTime === 'start') {
                normalizedDate.setUTCHours(0, 0, 0, 0); // Set time to 00:00:00 UTC for start date
            } else if (setTime === 'end') {
                normalizedDate.setUTCHours(23, 59, 59, 999); // Set time to 23:59:59 UTC for end date
            }
            return normalizedDate;
        };

        // Set default date range if none provided
      
        if (!startDate || !endDate) {
            const today = new Date();
        
            switch (reportType) {
                case 'daily': {
                    startDate = normalizeDateToUTC(today, 'start');
                    endDate = normalizeDateToUTC(today, 'end');
                    break;
                }
                case 'weekly': {
                    // Go back 6 days from today to get 7 days including today
                    const sevenDaysAgo = new Date(today);
                    sevenDaysAgo.setUTCDate(today.getUTCDate() - 6); // Past 6 days + today = 7
                    startDate = normalizeDateToUTC(sevenDaysAgo, 'start');
                    endDate = normalizeDateToUTC(today, 'end');
                    break;
                }
                case 'monthly': {
                    const thirtyDaysAgo = new Date(today);
                    thirtyDaysAgo.setUTCDate(today.getUTCDate() - 29); // Past 29 days + today = 30 days
                    startDate = normalizeDateToUTC(thirtyDaysAgo, 'start');
                    endDate = normalizeDateToUTC(today, 'end');
                    break;
                }
                default: {
                    const prevMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
                    const prevMonthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
                    startDate = normalizeDateToUTC(prevMonthStart, 'start');
                    endDate = normalizeDateToUTC(prevMonthEnd, 'end');
                    break;
                }
            }
        }
        
        const today = new Date();
        let start = startDate ? new Date(startDate) : new Date(today.setDate(today.getDate() - 30)); // default to 30 days ago
        let end = endDate ? new Date(endDate) : today;

        console.log("start date =", startDate);
        console.log("end date ", endDate);

        // Get the sales data from the database
        const salesData = await Order.aggregate([
            {
                $match: {
                    createdOn: {
                        $gte: new Date(start),
                        $lte: new Date(end),
                    },
                },
            },
            {
                $unwind: "$orderItems",
            },
            {
                $group: {
                    _id: "$orderItems.product",
                    totalSales: { 
                        $sum: { 
                            $multiply: ["$orderItems.price", "$orderItems.quantity"] 
                        } 
                    },
                    totalOrders: { $sum: 1 },
                    totalAmount: { 
                        $sum: { 
                            $multiply: ["$orderItems.price", "$orderItems.quantity"] 
                        } 
                    },
                    averageOrderValue: { 
                        $avg: { 
                            $multiply: ["$orderItems.price", "$orderItems.quantity"] 
                        } 
                    },
                    totalDiscount: { 
                        $sum: { 
                            $multiply: ["$discount", "$orderItems.quantity"] 
                        } 
                    },
                },
            },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails",
                },
            },
            {
                $unwind: "$productDetails",
            },
            {
                $project: {
                    productId: "$_id",
                    productName: "$productDetails.productName",
                    totalSales: 1,
                    totalOrders: 1,
                    totalAmount: 1,
                    averageOrderValue: 1,
                    totalDiscount: 1, // Corrected discount field
                    productImage: { $arrayElemAt: ["$productDetails.productImage", 0] },
                    totalOffer: "$productDetails.productOffer",
                },
            },
        ]);

        // Calculate totals for report
        console.log("sales data :", salesData);
        let totalProductsOrdered = 0;
        let totalAmountSpent = 0;
        let totalDiscount = 0;

        for (const data of salesData) {
            totalProductsOrdered += data.totalOrders;
            totalAmountSpent += data.totalSales;
            totalDiscount += data.totalDiscount;
        }
        
        if (req.query.download === 'order_pdf') {
          try {
              // Generate HTML content
              
              const htmlContent = generateHTMLReport(salesData, totalProductsOrdered, totalAmountSpent, start, end, reportType);
              const browser = await puppeteer.launch({
                  headless: true,
                  args: ['--no-sandbox', '--disable-setuid-sandbox']
              });
              
              const page = await browser.newPage();
              await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
              
              // Generate PDF buffer
              const pdfBuffer = await page.pdf({
                  format: 'A4',
                  printBackground: true,
                  margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
              });
      
              await browser.close();
      
              // Set proper headers
              res.setHeader('Content-Type', 'application/pdf');
              
              // For direct download
              if (req.query.mode === 'download') {
                  res.setHeader('Content-Disposition', 'attachment; filename="sales_report.pdf"');
              } 
              // For preview
              else {
                  res.setHeader('Content-Disposition', 'inline; filename="sales_preview.pdf"');
              }
      
              // Send the binary data
              res.writeHead(200, {
                  'Content-Length': Buffer.byteLength(pdfBuffer)
              });
              res.end(pdfBuffer);
      
          } catch (error) {
              console.error('PDF generation failed:', error);
              res.status(500).send('Failed to generate PDF report');
          }
          return;
      }
        
        else {
            // Render the report page as usual
            res.render('report', {
                salesData,
                totalSales: totalAmountSpent,
                totalOrders: totalProductsOrdered,
                totalDiscount, // Display total discount here
                reportDuration: `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`,
                startDate,
                endDate,
                reportType,
                totalAmount: totalAmountSpent,
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching sales data");
    }
};

function generateHTMLReport(salesData, totalOrders, totalSales, startDate, endDate, reportType) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Sales Report</title>
        <style>
            body {
                font-family: 'Arial', sans-serif;
                margin: 0;
                padding: 20px;
                color: #333;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #3498db;
                padding-bottom: 10px;
            }
            h1 {
                color: #2c3e50;
                margin: 0;
            }
            .report-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
            }
            .report-dates {
                background-color: #f8f9fa;
                padding: 10px 15px;
                border-radius: 5px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
            }
            th {
                background-color: #3498db;
                color: white;
                padding: 12px;
                text-align: left;
            }
            td {
                padding: 10px;
                border-bottom: 1px solid #ddd;
            }
            tr:nth-child(even) {
                background-color: #f2f2f2;
            }
            .summary {
                margin-top: 30px;
                padding: 20px;
                background-color: #e8f4fc;
                border-radius: 5px;
            }
            .summary-item {
                margin: 10px 0;
                font-size: 16px;
            }
            .currency {
                font-family: 'Courier New', monospace;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Sales Report</h1>
            <div class="report-info">
                <div class="report-dates">
                    <p><strong>Report Period:</strong> ${reportType || 'Custom Range'}</p>
                    <p><strong>From:</strong> ${startDate.toISOString().split('T')[0]}</p>
                    <p><strong>To:</strong> ${endDate.toISOString().split('T')[0]}</p>
                </div>
                <div class="report-dates">
                    <p><strong>Generated On:</strong> ${new Date().toISOString().split('T')[0]}</p>
                </div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Product Name</th>
                    <th>Quantity Sold</th>
                    <th>Total Orders</th>
                    <th>Total Discount</th>
                    <th>Total Amount</th>
                    <th>Avg. Order Value</th>
                </tr>
            </thead>
            <tbody>
                ${salesData.map(product => `
                    <tr>
                        <td>${product.productName}</td>
                        <td>${product.totalSales}</td>
                        <td>${product.totalOrders}</td>
                        <td class="currency">₹${product.totalDiscount.toFixed()}</td>
                        <td class="currency">₹${product.totalAmount.toFixed()}</td>
                        <td class="currency">₹${product.averageOrderValue.toFixed()}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="summary">
            <h2>Summary</h2>
            <div class="summary-item"><strong>Total Products Ordered:</strong> ${totalOrders}</div>
            <div class="summary-item"><strong>Total Sales Amount:</strong> ₹${totalSales.toFixed()}</div>
            <div class="summary-item"><strong>Total Discount Given:</strong> ₹${salesData.reduce((sum, item) => sum + item.totalDiscount, 0).toFixed()}</div>
            <div class="summary-item"><strong>Average Order Value:</strong> ₹${(totalSales / totalOrders).toFixed()}</div>
        </div>
    </body>
    </html>
  `;
}
const getCsvReports = async (req, res) => {
    try {
        console.log("CSV Report Request Received");
        
        // Get query parameters
        let { startDate, endDate, reportType } = req.query;

        // Date normalization function
        const normalizeDateToUTC = (date, setTime = 'start') => {
            const normalizedDate = new Date(date);
            if (setTime === 'start') {
                normalizedDate.setUTCHours(0, 0, 0, 0);
            } else {
                normalizedDate.setUTCHours(23, 59, 59, 999);
            }
            return normalizedDate;
        };

        // Set default date range if none provided
        if (!startDate || !endDate) {
            const today = new Date();
            switch (reportType) {
                case 'daily':
                    startDate = normalizeDateToUTC(today, 'start');
                    endDate = normalizeDateToUTC(today, 'end');
                    break;
                case 'weekly':
                    const dayOfWeek = today.getUTCDay();
                    const diffToSunday = today.getUTCDate() - dayOfWeek;
                    const startOfWeek = new Date(today.setUTCDate(diffToSunday));
                    startDate = normalizeDateToUTC(startOfWeek, 'start');
                    endDate = normalizeDateToUTC(new Date(startOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6)), 'end');
                    break;
                case 'monthly':
                    startDate = new Date(today.getUTCFullYear(), today.getUTCMonth(), 1);
                    endDate = new Date(today.getUTCFullYear(), today.getUTCMonth() + 1, 0);
                    endDate = normalizeDateToUTC(endDate, 'end');
                    break;
                default:
                    startDate = new Date(today.setUTCMonth(today.getUTCMonth() - 1));
                    startDate = normalizeDateToUTC(startDate, 'start');
                    endDate = new Date(today.setUTCHours(23, 59, 59, 999));
                    break;
            }
        } else {
            startDate = normalizeDateToUTC(startDate, 'start');
            endDate = normalizeDateToUTC(endDate, 'end');
        }

        console.log("Fetching data from:", startDate, "to", endDate);

        // Get sales data
        const salesData = await Order.aggregate([
            {
                $match: {
                    createdOn: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate),
                    },
                    status: { $ne: 'Cancelled' }
                },
            },
            { $unwind: "$orderItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderItems.product",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $addFields: {
                    "itemTotal": {
                        $multiply: ["$orderItems.price", "$orderItems.quantity"]
                    },
                    // Calculate discount amount for each item proportionally
                    "itemDiscountAmount": {
                        $multiply: [
                            {
                                $divide: [
                                    { $ifNull: ["$discount", 0] },
                                    100
                                ]
                            },
                            { $multiply: ["$orderItems.price", "$orderItems.quantity"] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: "$orderItems.product",
                    productName: { $first: "$productDetails.productName" },
                    totalQuantity: { $sum: "$orderItems.quantity" },
                    totalOrders: { $sum: 1 },
                    totalSales: { 
                        $sum: "$itemTotal" 
                    },
                    totalDiscount: { 
                        $sum: "$itemDiscountAmount" 
                    },
                }
            },
            {
                $project: {
                    productId: "$_id",
                    productName: 1,
                    totalQuantity: 1,
                    totalOrders: 1,
                    totalSales: 1,
                    totalDiscount: {
                        $round: ["$totalDiscount", 2]
                    },
                    netAmount: { 
                        $round: [
                            { $subtract: ["$totalSales", "$totalDiscount"] },
                            2
                        ] 
                    },
                    averageOrderValue: {
                        $cond: [
                            { $eq: ["$totalOrders", 0] },
                            0,
                            {
                                $round: [
                                    { $divide: [
                                        { $subtract: ["$totalSales", "$totalDiscount"] },
                                        "$totalOrders"
                                    ]},
                                    2
                                ]
                            }
                        ]
                    }
                }
            }
        ]);
        // Calculate totals
        console.log("salesdata = ",salesData)
        const totals = salesData.reduce((acc, item) => {
            acc.totalQuantity += item.totalQuantity;
            acc.totalOrders += item.totalOrders;
            acc.totalSales += item.totalSales;
            acc.totalDiscount += item.totalDiscount;
            acc.netAmount += item.netAmount;
            return acc;
        }, {
            totalQuantity: 0,
            totalOrders: 0,
            totalSales: 0,
            totalDiscount: 0,
            netAmount: 0
        });
        // Prepare CSV data
        const fields = [
            { label: 'Product ID', value: 'productId' },
            { label: 'Product Name', value: 'productName' },
            { label: 'Quantity Sold', value: 'totalQuantity' },
            { label: 'Total Orders', value: 'totalOrders' },
            { label: 'Gross Sales (₹)', value: 'totalSales' },
            { label: 'Total Discount (₹)', value: 'totalDiscount' },
            { label: 'Net Amount (₹)', value: 'netAmount' },
            { label: 'Avg. Order Value (₹)', value: 'averageOrderValue' }
        ];

        // Add summary row
        const csvData = [
            ...salesData,
            {
                productId: 'TOTAL',
                productName: 'SUMMARY',
                totalQuantity: totals.totalQuantity,
                totalOrders: totals.totalOrders,
                totalSales: totals.totalSales,
                totalDiscount: totals.totalDiscount,
                netAmount: totals.netAmount,
                averageOrderValue: totals.totalSales / totals.totalOrders
            }
        ];

        // Generate CSV
        const parser = new Parser({ fields });
        const csv = parser.parse(csvData);

        // Set response headers
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=sales_report_${new Date().toISOString().slice(0,10)}.csv`);
        return res.send(csv);

    } catch (error) {
        console.error('CSV Generation Error:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Failed to generate CSV report',
            error: error.message
        });
    }
};

module.exports = {
    getOrders,
    getOrderDetails,
    updateOrderStatus,
    cancelOrder,
    orderCancelled,
    getReports,
    generateHTMLReport,
    // authorizeReturn 
    approveRefund,
    rejectRefund,
    getCsvReports,
};