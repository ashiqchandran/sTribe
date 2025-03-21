const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController=require("../controllers/admin/customerController")
const categoryController=require("../controllers/admin/categoryController")
const brandController=require("../controllers/admin/brandController")
const productController=require("../controllers/admin/productController")
const bannerController=require("../controllers/admin/bannerController")
const orderController=require("../controllers/admin/orderController")
const {adminAuth,userAuth} = require("../middleweres/auth");
const multer=require("multer");
const upload = require("../helpers/multer"); // Import multer instance
 


// Route to render the login page (GET request)
router.get("/login",adminController.adminLogin);
// Route to handle admin login form submission (POST request)
router.post("/adminsignin", adminController.adminsignin);

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
router.post("/addProduct", upload.array("images", 5), productController.addProduct);
router.get("/allProducts",adminAuth,productController.getAllProducts)
router.get("/pageError",adminAuth,productController.pageNotFound)
router.post("/addProductOffer", adminAuth, productController.updateProductOffer); // Add product offer

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

module.exports = router;
