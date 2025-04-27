const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController=require("../controllers/admin/customerController")
const categoryController=require("../controllers/admin/categoryController")
const brandController=require("../controllers/admin/brandController")
const productController=require("../controllers/admin/productController")
const bannerController=require("../controllers/admin/bannerController")
const orderController=require("../controllers/admin/orderController")
const couponController=require("../controllers/admin/couponController")
const transactionController=require("../controllers/admin/transactionController");
const { Parser } = require('json2csv');
const fs = require('fs');
const Transaction = require("../models/transactionSchema");
// In your route file (e.g., routes/admin.js)

const {adminAuth,userAuth} = require("../middleweres/auth");
const multer=require("multer");
const upload = require("../helpers/multer"); // Import multer instance
 


// Route to render the login page (GET request)
router.get("/login",adminController.adminLogin);
// Route to handle admin login form submission (POST request)
router.post("/adminsignin", adminController.adminsignin);


router.post("/dashboard",adminController.adminDashboard)


router.get("/dashboard",adminController.adminDashboard)

router.get("/pageError",adminController.pageError_404)

router.get("/logout", adminController.adminLogout);

router.get("/users",adminAuth, customerController.customerInfo);
router.get("/blockCustomer",adminAuth, customerController.customerBlocked);
router.get("/unblockCustomer",adminAuth, customerController.customerUnblocked);



router.get('/category', adminAuth, categoryController.categoryInfo);
router.post('/addCategory', adminAuth, categoryController.addCategory);
router.post('/addCategoryOffer', adminAuth, categoryController.addCategoryOffer);
router.post('/removeCategoryOffer', adminAuth, categoryController.removeCategoryOffer);
router.get('/listCategory', adminAuth, categoryController.getListCategory);
router.get('/unListCategory', adminAuth, categoryController.getUnlistCategory);
router.get('/editCategory', adminAuth, categoryController.getEditCategory);
router.post('/editCategory/:id', adminAuth, categoryController.editCategory);
router.post("/editCategoryOffer", adminAuth, categoryController.editCategoryOffer)
router.delete("/deleteCategory/:id", adminAuth, categoryController.deleteCategory)


// router.get("/brands",adminAuth,brandController.getBrandPage)
// router.post("/addBrand",adminAuth,upload.single("image"),brandController.addBrand)

//product management
router.get("/products", adminAuth, productController.getProductAddPage);
router.post("/addProduct",  adminAuth,upload.array("images", 5), productController.addProduct);
router.get("/allProducts",adminAuth,productController.getAllProducts)
router.get("/pageError",adminAuth,productController.pageNotFound)
router.post("/addProductOffer", adminAuth, productController.updateProductOffer); // Add product offer
router.get('/complaints', adminAuth, customerController.complaints);
router.post("/removeProductOffer", adminAuth, productController.removeProductOffer); // Remove product offer
router.post("/blockProduct", adminAuth, productController.blockProduct); // Block product
router.post("/unblockProduct", adminAuth, productController.unblockProduct); // Unblock product
router.get("/editProduct", adminAuth, productController.getEditProduct); // Get product for editing
router.post("/deleteImage", adminAuth, productController.deleteSingleImage); // Delete single image

router.post("/deleteproduct", adminAuth, productController.deleteProduct); // Delete product

router.post("/editProduct/:id", adminAuth, upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
]), productController.editProduct);
//banner fetching
router.get("/banner",adminAuth, bannerController.getBanner)

// Order Management Routes
router.get('/orders', adminAuth, orderController.getOrders);
router.get('/orders/:id', adminAuth, orderController.getOrderDetails);
router.post('/orders/update-status', adminAuth, orderController.updateOrderStatus);

router.post('/orders/cancel',adminAuth,orderController.orderCancelled)
router.get("/report", adminAuth, orderController.getReports);
router.get("/csvreport", adminAuth, orderController.getCsvReports);

// router.post('/approveReturn', adminAuth, orderController.authorizeReturn);
router.post('/orders/approve-refund',adminAuth, orderController.approveRefund);
router.post('/orders/reject-refund', orderController.rejectRefund)

router.get("/transaction",adminAuth,transactionController.transactionLoad)

//coupon management
router.get("/coupon",adminAuth,couponController.loadCoupon)
router.post("/createCoupon",adminAuth,couponController.createCoupon)
router.get("/editCoupon",adminAuth,couponController.editCoupon)
// router.get("/admin/deleteCoupon'", adminAuth, couponController.deleteCoupon);
router.get('/deleteCoupon',  adminAuth,couponController.deleteCoupon);

router.post('/updateCoupon', adminAuth, couponController.updateCoupon);


// Route to handle the transaction filter request from frontend (AJAX request)
router.post('/filterTransaction', async (req, res) => {
  try {
    const { transactionType, fromDate, toDate, page = 1, limit = 10 } = req.body;
    
    // Build a filter object based on available filters
    let filter = {};
    
    if (transactionType) {
      filter.transactionType = transactionType;
    }
    
    if (fromDate && toDate) {
      filter.date = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      };
    }
    
    // Calculate pagination values
    const skip = (page - 1) * limit;
    
    // Fetch the filtered transactions with pagination
    const transactions = await Transaction.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Get total count for pagination info
    const total = await Transaction.countDocuments(filter);
    
    // Send response with pagination metadata
    res.json({ 
      transactions,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching transactions' });
  }
});

  router.get('/orderDetailPage/:orderId', adminAuth, transactionController.orderDetailPage);
router.get('/transaction/:orderId', adminAuth, transactionController.orderDetailPage); // New
router.get('/orders/:orderId', adminAuth, orderController.getOrderDetails);




module.exports = router;
module.exports = router;
