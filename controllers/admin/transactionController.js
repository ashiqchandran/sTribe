const Transaction = require("../../models/transactionSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const Category=require("../../models/categorySchema");
const transactionLoad = (req, res) => {
    try {
        res.render("transactions"); // Make sure this matches your view filename
    } catch (error) {
        console.error('Transaction page error:', error);
        res.status(500).render('pageError');
    }
};

const orderDetailPage = async (req, res) => {
    try {
      const trans = req.params.orderId; // Could be ORDER-<uuid> or ObjectId
      console.log("Fetching order for orderId:", trans);
  
      // Fetch by orderId (string) or _id (ObjectId)
     
    const order = await Order.findOne({
      $or: [{ orderId: trans }, { transactionId: trans }]
    })
      .populate('userId', 'name email')
      .populate({
        path: 'orderItems.product',
        select: 'productName category price productImage',
        populate: {
          path: 'category',
          model: 'Category',
          select: 'name' // this fetches category name only
        }
      })
      .lean();
  
  console.log("order = ",order)
      if (!order) {
        console.log("Order not found for orderId:", trans);
        return res.render('orderDetailPage', { order: null, transaction: null, error: 'Order not found' });
      }
  
      let transaction = null;
      if (order.transactionId) {
        transaction = await Transaction.findOne({ _id: order.transactionId })
        .lean();
      }

      const productId = order.orderItems[0].product; // <-- get the actual ObjectId
const product = await Product.findById(productId).lean();

const categoryId = product.category; // <-- get the actual ObjectId
const category = await Category.findById(categoryId).lean();

      
      order.orderDate = new Date(order.createdOn).toLocaleString();
      order.customerName = order.userId?.name || 'N/A';
      order.customerEmail = order.userId?.email || 'N/A';
  
      console.log("Found order:", order);
      res.render('orderDetailPage', { order, transaction,product, category,error: null });
    } catch (error) {
      console.log("Error fetching order details:", error);
      res.render('orderDetailPage', { order: null, transaction: null, error: 'Server error' });
    }
  };
module.exports = {
    transactionLoad,
    orderDetailPage

};