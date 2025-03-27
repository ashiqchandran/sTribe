const express = require("express");
const router = express.Router();
const passport = require('passport');
// Correct the path here:

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
router.get("/contact",contactController.getContactPage);
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
router.get("/checkout",userAuth,cartController.loadCheckoutPage)
router.delete('/removeCartItem', userAuth, cartController.removeCartItem)

//wishlist
router.get('/wishlist',userAuth,wishlistController.loadWishlist)
router.post('/addToWishlist',userAuth,wishlistController.addToWishlist)
router.get('/addToCartt',userAuth, wishlistController.addToCart)
// router.delete('/removeFromWishlist',userAuth,wishlistController.removeProduct)


// Order Management
router.post("/placeOrder", userAuth, orderController.placeOrder);
router.post("/walletPayment",userAuth,transactionController.walletPayment);
router.get("/orders", userAuth, orderController.getOrders);
router.get("/order-details", userAuth, orderController.loadOrderDetails);
router.get("/success",userAuth,orderController.success)
// New routes for order cancellation and returns
router.post("/orders/cancel", userAuth, orderController.cancelOrder);

//productloader shows all products 

router.get('/wishlist',wishlistController.loadWishlist)
router.get('/addToWishlist',wishlistController.addToWishlist)
router.get('/removeFromWishlist',wishlistController.deleteFromWishlist)

router.get("/productloader", userController.getProductLoader);

//loading products information to the user page filter-products
router.post("/filterproducts",userAuth,productController.filterProducts)

router.get("/productDetails",productController.productDetails);
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
router.post("/change-password", userAuth, profileController.changePassword)

//wallet management
router.post("/add",userAuth, walletController.addFunds);
router.post("/withdraw",userAuth, walletController.withdrawFunds);
router.post("/purchase", userAuth,walletController.purchaseWithWallet);



module.exports = router;