const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");


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
                    "orderItems.quantity": "$orderItems.quantity" // Keep quantity from the order
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
        const order = await Order.findById(orderId)
            .populate({
                path: "orderedItems.product",
                select: "productName productImage price quantity",
            });

        if (!order) {
            return res.status(404).send("Order not found");
        }

        res.render("admin-order-details", {
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

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Don't allow status change if order is cancelled
        if (order.status === 'cancelled') {
            return res.status(400).json({ success: false, message: "Cannot update cancelled order" });
        }

        // Update order status
        order.status = status;
        order.orderedItems[0].status = status;

        await order.save();
        res.json({ success: true, message: "Order status updated successfully" });
    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
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


module.exports = {
    getOrders,
    getOrderDetails,
    updateOrderStatus,
    cancelOrder
};