const express = require("express");
const router = express.Router();
const passport = require('passport');
// Correct the path here:
const Order = require("../models/orderSchema");
const userController = require("../controllers/user/userController");
const productController=require("../controllers/user/productController")
const profileController=require("../controllers/user/profileController")
const cartController=require("../controllers/user/cartController")
const contactController=require("../controllers/user/contactController")
const orderController=require("../controllers/user/orderController")
const aboutController=require("../controllers/user/aboutController")
const walletController = require("../controllers/user/walletController");
const transactionController = require("../controllers/user/transactionController");


const wishlistController= require("../controllers/user/wishlistController.js")
const {adminAuth,userAuth} = require("../middleweres/auth");
const multer=require("multer");

const upload = require("../helpers/multter"); // Import multer instance

router.get("/", userController.loadHomePage);   
router.get("/home", userController.loadHomePage);
router.get("/signin", userController.loadSignin);
router.post("/signin", userController.loadEnter);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.loadRegister);

//userprofile
router.get("/about",aboutController.getAboutPage);
router.get("/profile",userAuth,profileController.getprofile)
router.patch('/update-profile', profileController.updateProfile);

router.get("/contact",contactController.getContactPage);
router.post('/contact', contactController.submitContactForm); // <--- this is important

router.post("/verifyotp", userController.loadverifyotp);
router.post("/resend-otp", userController.loadresendotp);
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }), (req, res) => {
    req.session.user = req.user; // Store Google user in session
    console.log("Google User saved in session:", req.session.user); // Debugging
    res.redirect('/');
});
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), (req, res) => {
    req.session.user = req.user; // Store Google user in session
    console.log("Google User saved in session:", req.session.user); // Debugging
    res.redirect('/');

router.get("/pageNotFound",userController.pageNotFound)
});
router.get("/refferal",userController.getRefferalPage);
router.get("/wallet",userController.getWalletPage);
router.get("/mycoupons",userController.getmycouponspage);

router.get("/logout", userController.logout);
router.get("/forgotpassword", userController.loadforgotpasword);
router.post("/forgotpassword", userController.changePassword);

router.get("/forgotpassword", userController.loadforgopasswordOtp);

router.post("/VerifychangemailOtp", userController.VerifychangemailOtp);

router.get("/newemail", userController.loadnewpassword);
// router.post("/loadnewmailpage", userController.loadnewmail);
// router.post("/newpassword", userController.loadnewpassword);

router.post("/setNewPassword",userController.changepassword)
router.get("/shop",userController.loadShoppingPage)
router.get('/filter', userController.filterProduct);

//checkout management
router.get("/cart", userAuth, cartController.getCartPage);
router.get('/addToCart',userAuth, cartController.addToCart)
router.post('/updateCartItem',userAuth, cartController.updateCartItem)
router.get("/checkout",userAuth,cartController.loadCheckoutPage)
router.delete('/removeCartItem', userAuth, cartController.removeCartItem)
router.post('/applyCoupon',userAuth,cartController.applyCoupon)
//wishlist
router.get('/wishlist',userAuth,wishlistController.loadWishlist)
router.post('/addToWishlist',userAuth,wishlistController.addToWishlist)
router.get('/addToCartt',userAuth, wishlistController.addToCart)
// router.delete('/removeFromWishlist',userAuth,wishlistController.removeProduct)


// Order Management
router.get('/getWalletBalance', userAuth, orderController.getWalletBalance);

router.post("/placeOrder", userAuth, orderController.placeOrder);
router.post("/walletPayment",userAuth,transactionController.walletPayment);
router.get("/orders", userAuth, orderController.getOrders);
router.get('/trackOrders/:id', userAuth, orderController.getOrderDetails);
router.get("/order-details", userAuth, orderController.loadOrderDetails);
router.get('/orders/get-rejection-message/:orderId', async (req, res) => {
  try {
      const { orderId } = req.params;
      const mongoose = require('mongoose');
      const order = await Order.findOne({ _id: new mongoose.Types.ObjectId(orderId) });
      
console.log("off =",order)
      if (!order) return res.json({ success: false, message: 'Order not found' });

      // Find the rejected item and get its admin message
      const rejectedItem = order.returnReason||"no reson"
   
      res.json({
          success: true,
          messageFromBackend: rejectedItem
      });
  } catch (err) {
      console.error('Error fetching rejection reason:', err);
      res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get("/success",userAuth,orderController.success)
router.post("/razorpayPayment", userAuth,orderController.razorpayPayment);
router.post("/razorpayPaymentsuccess", userAuth,orderController.razorpayPaymentsuccess);
router.post("/cancelgroup",userAuth,orderController.cancelgroup)
router.get("/payment/failure",userAuth,orderController.failure)
router.post('/retryPayment/:orderId', userAuth, orderController.retryPayment)
router.post('/verify-payment', userAuth, orderController.verifypayment)

// New routes for order cancellation and returns
router.post("/orders/cancel", userAuth, orderController.cancelOrder);
router.post("/requestReturn", userAuth, orderController.requestReturn);
router.post('/product/rate', userAuth, orderController.rate);

router.get("/orders/invoice", userAuth, orderController.invoiceDownload);

//productloader shows all products 

router.get('/wishlist',wishlistController.loadWishlist)
router.get('/addToWishlist',wishlistController.addToWishlist)
router.get('/removeFromWishlist',wishlistController.deleteFromWishlist)

router.get("/productloader", userController.getProductLoader);

//loading products information to the user page filter-products
router.post("/filterproducts",userAuth,productController.filterProducts)

router.get("/productDetails",productController.productDetails);
router.post("/updateProductVariant",productController.updateProductVariant);


router.get("/filter",productController.productDetails);

router.get("/address",userAuth,profileController.loadAddressPage);
router.get("/addAddress",userAuth,profileController.addAddress)
 router.post("/addAddress",userAuth,profileController.postAddAddress)
router.get("/editAddress",userAuth,profileController.editAddress);
 router.post("/editAddress",userAuth,profileController.postEditAddress)
router.get("/deleteAddress",userAuth,profileController.deleteAddress)


//profile management
router.post("/update-profile",userAuth,profileController.updateProfile)
router.get("/change-email",userAuth,profileController.changeEmail)
router.post("/change-email",userAuth,profileController.changeEmailValid)
router.post("/verify-email-otp",userAuth,profileController.verifyEmailOtp)
router.post("/update-email",userAuth,profileController.updateEmail)
router.post('/upload-profile-pic/:id', upload.single('profileImage'),profileController.addProfile)
router.post("/change-password", userAuth, userController.changePassword)

//wallet management

router.post('/wallet/create-razorpay-order', walletController.createRazorpayOrder);
router.post('/wallet/verify-payment', walletController.verifyPayment);
// In your walletRoutes.js
// walletRoutes.js
// walletRoutes.js
router.post('/wallet/create-withdrawal-order',  walletController.createWithdrawalOrder);
router.post('/wallet/verify-withdrawal',  walletController.verifyWithdrawal);
// router.post("/purchase", userAuth,walletController.purchaseWithWallet);
// router.post("/razorpay", userAuth,walletController.purchaseWithRazorpay);

router.post("/addPromoCode", userAuth,walletController.addPromoCode);
router.post('/clearCoupon', (req, res) => {
  // Assuming you're using session-based storage
  req.session.coupon = null;
  res.json({ success: true, message: 'Coupon cleared successfully.' });
});



router.get('/order-status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.status(200).json({
            success: true,
            status: order.status // Or any field you want to show
        });
    } catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;