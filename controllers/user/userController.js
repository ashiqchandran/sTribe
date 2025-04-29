const User=require('../../models/userSchema')
const Category=require("../../models/categorySchema")
const Product=require("../../models/productSchema")
const Order=require("../../models/orderSchema")
const Cart = require("../../models/cartSchema")
const Coupon =require("../../models/couponSchema");
const ReferralCoupon =require("../../models/dcouponSchema");
const Transaction = require("../../models/transactionSchema");
const nodemailer=require("nodemailer")
const bcrypt = require("bcrypt")
const env =require("dotenv").config()
const saltround = 10
const { ObjectId } = require('mongodb');

const loadHomePage = async (req, res) => {
    try {
        const user = req.session.user;  // Check if user is logged in
        console.log("user = ",user)
        // Fetching categories that are listed
        const categories = await Category.find({ isListed: true });

        // Fetching products (products that are not blocked, belong to the listed categories, and have quantity > 0)
        const productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 }
        })
        .populate('category', 'name image') // Populate category details (name & image)
        .sort({ createdOn: -1 }) // Sort by the most recently added products
        .limit(4); // Limit to 4 products

        // Fetching most selling products (products that are not blocked, belong to the listed categories, and have quantity <= 10)
        const mostsellingProduct = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            quantity: { $lte: 10 }
        })
        .populate('category', 'name image') // Populate category details
        .sort({ createdOn: -1 }) // Sort by newest
        .limit(4); // Limit to 4 most selling products

        // If user is logged in, fetch user data
        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user });  // Fetch user details from the User collection
        }
        

        const topProducts = await Order.aggregate([
            {
                $match: { status: 'delivered' } // Only consider delivered orders
            },
            {
                $unwind: '$orderItems' // Flatten the orderItems array
            },
            {
                $group: {
                    _id: '$orderItems.product', // Group by product ID
                    totalSold: { $sum: '$orderItems.quantity' },
                    revenue: {
                        $sum: {
                            $multiply: ['$orderItems.quantity', '$orderItems.price']
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'products', // Join with Product collection
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            {
                $unwind: {
                    path: '$productDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'categories', // Join with Category collection
                    localField: 'productDetails.category',
                    foreignField: '_id',
                    as: 'categoryDetails'
                }
            },
            {
                $unwind: {
                    path: '$categoryDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    productImg: {
                        $cond: [
                            { $gt: [{ $size: '$productDetails.productImage' }, 0] },
                            { $arrayElemAt: ['$productDetails.productImage', 0] },
                            '/images/default-product.jpg' // Fallback if no image
                        ]
                    },
                    productName: '$productDetails.productName',
                    categoryName: '$categoryDetails.name',
                    brand: '$productDetails.brand',
                    price: '$productDetails.salePrice',
                    stock: '$productDetails.quantity',
                    rprice:'$productDetails.regularPrice',
                   
                    totalSold: 1,
                    revenue: 1
                }
            },
            { $sort: { totalSold: -1 } }, // Sort by total sold
            { $limit:4 } // Top 10 products
        ]);
    	// console.log("top selling = ",topProducts)
        // Render the home page and pass the user details, products, and top sellers to the view
        
        res.render('home', {
            user: userData,               // Passing the user details (if logged in)
            products: productData,        // Passing the latest products
            topSeller: mostsellingProduct, // Passing the most selling products
            topProducts
        });

    } catch (error) {
        console.error('Error loading home page:', error);
        res.status(500).send('Server Error');
    }
};





const loadSignUpPage = async (req, res) => {
    try {
        res.render('signup')
    } catch (error) {
        console.log('Sign Up Page Not Found')
        res.status(500).send('Server Error')
    }
}

const pageNotFound=async(req,res)=>{
    try{
        res.render("fullerror")
    }
    catch(error){
        res.redirect("/pageNotFound")
    }
   
}

const loadSignin=async(req,res)=>{
    try{
        res.render('signin' ,{message:""})
    }catch(error)
    {
        res.status(500).render('error',{message:"error while loading"})
    }
}

const loadSignup=async(req,res)=>{
    try{
        res.render('signup')
    }catch(error)
    {
        res.status(500).render('error')
    }
}

function generateotp(){
 return Math.floor(100000+Math.random()*900000)
}

const changeEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        console.log("email  = ", email);

        const userExist = await User.findOne({ email });

        if (!userExist) {
            return res.status(404).json({ success: false, message: 'User with this email does not exist.' });
        }

        const otp = generateotp();
        const emailSent = await sendVerificationEmail(email, otp);

        console.log(`Email Sent: ${email}, OTP: ${otp}`);
        if (emailSent) {
            req.session.emailchangeOtp = otp;
            req.session.userdata = req.body;
            req.session.email = email;

            return res.status(200).json({ success: true, redirect: '/verifyemailotp' });
        } else {
            return res.status(500).json({ success: false, message: 'Failed to send verification email.' });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};

const changeEmailOtp = async(req,res)=>{
    try {
        const { otp } = req.body;
       const sessionOtp= req.session.emailchangeOtp
        const currentUser = req.user;

        // Validate session exists
       

        // // Check OTP expiry
        // if (Date.now() > otpExpiry) {
        //     req.session.otpData = null; // Clear expired OTP
        //     return res.status(400).json({ 
        //         success: false,
        //         message: 'OTP has expired. Please request a new one.' 
        //     });
        // }

        // Verify OTP matches
     
        if (otp != sessionOtp) {
            res.json({
                success: false
        
            });
        }
        // Send success response
        res.json({
            success: true,
            message: 'Email successfully updated!',
            redirectUrl: '/profile' // Where to redirect after success
        });

    } catch (error) {
        console.error('Error in verifyChangeEmailOTP:', error);
        res.status(500).json({ 
            success: false,
            message: 'An error occurred. Please try again.' 
        });
    }


}


async function sendVerificationEmail(email,otp)
{
    try {
        const transporter=nodemailer.createTransport({
            service:'gmail',
            port:'587',
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        });
        const info=await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"verify your account",
            text:`your otp is ${otp}`,
            html:`<b>Your otp is ${otp}</b>`

    })
    return info.accepted.length>0

    } catch (error) {
        console.log(error.message)
        res.status(404).send("message not send")
    }
}
const loadEnter = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(email.toString()); // Avoid `toString(email)`, it should be `email.toString()`

        // Check if email and password are provided
        if (!email || !password) {
            return res.render("signin", { message: "Please provide both email and password." });
        }

        const findUser = await User.findOne({ email });
        if (!findUser) {
            console.log("User not found");
            return res.render("signin", { message: "User not found" });
        }

        if (findUser.isBlocked) {
            return res.render("signin", { message: "User is blocked by admin" });
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);
        if (!passwordMatch) {
            console.log("Password does not match");
            return res.render("signin", { message: "Incorrect Password" });
        }

        req.session.user = findUser; // Ensure only the ID is stored
        // Store entire user object in session

        console.log(findUser.fullname);
        res.redirect("/"); // Redirect to home page

    } catch (error) {
        console.error("Login error", error);
        res.render("signin", { message: "Login failed. Please try again later" });
    }
};

const loadRegister=async(req,res)=>{

    try{
        const {fullname,email,phone,password,referralCode }=req.body

        const findUser = await User.findOne({email})

        if(findUser){
            return res.render("signin", {message: "User Already exists"})
        } 

        const otp=generateotp();
        const emailSend=await sendVerificationEmail(email,otp)
        if(!emailSend)
        {
            return res.json("email-error")
        }
        req.session.userotp=otp
        req.session.userData={fullname,phone,email,password,referralCode}        
        console.log("otp send org ",otp)
        res.render('verify')
       
        } catch(error) {
        console.log(error.message)
        
    }   
   
}

const securePassword=async(password)=>{
    try {
        const  passwordHash=await bcrypt.hash(password,saltround)
        return passwordHash
    } catch (error) {
        
    }
}


const generateReferralCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const loadverifyotp = async (req, res) => {
    console.log("Verify OTP");

    try {
        const { otp } = req.body;
        console.log("otp = ", otp);

        if (!otp) {
            return res.status(400).json({ success: false, message: "OTP is required" });
        }

        // Validate OTP format and session
        if (typeof req.session.userotp === 'undefined') {
            return res.status(400).json({ success: false, message: "OTP expired or not generated" });
        }

        const np = parseInt(otp);
        if (isNaN(np)) {
            return res.status(400).json({ success: false, message: "Invalid OTP format" });
        }

        if (np !== req.session.userotp) {
            console.log("Wrong OTP");
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        const user = req.session.userData;
        if (!user) {
            return res.status(400).json({ success: false, message: "User data not found in session" });
        }

        const passwordHashed = await securePassword(user.password);
        const referralCode = generateReferralCode(); // Generate here to ensure freshness
        console.log("New user's referralCode = ", referralCode);

        let referrer = null;  // Initialize the referrer variable
        
        // Handle referral if exists (for referrer)
        if (user.referralCode) { // Note: Fix spelling if your field is 'referralCode'
            try {
                const referrer = await User.findOne({ referralCode: user.referralCode });
                if (referrer) {
                    await User.updateOne(
                        { referralCode: user.referralCode },
                        { $inc: { referalPoint: 10 } }
                    );
                
                    const refCode = generateReferralCode();
                    const dcoupon = new ReferralCoupon({
                        code: refCode,
                        discountAmount: 50,
                        owner: referrer._id
                    });
                    const refercode = await dcoupon.save();
                
                    // Ensure coupons array exists
                    if (!Array.isArray(referrer.coupons)) {
                        referrer.coupons = [];
                    }
                
                    referrer.coupons.push(refercode._id);
                    await referrer.save();
                }
                
            } catch (error) {
                console.error("Referral processing error:", error);
                return res.status(400).json({ message: 'Invalid referral code' });
                // Continue with registration even if referral fails
            }
        }
        referrer = await User.findOne({ referralCode: user.referralCode });
        // Create new user with their own referral code
        const userData = {
            fullname: user.fullname,
            phone: user.phone,
            email: user.email,
            googleId: user.googleId || Math.floor(Math.random() * 100000),
            password: passwordHashed,
            referralCode: referralCode, // Always assign new referral code,
            referredBy: referrer ? referrer._id : null // Set referrer if exists
        };

        const saveUserData = new User(userData);
        await saveUserData.save();

        // Update session and clean up
        req.session.user = saveUserData._id;
        delete req.session.userotp;
        delete req.session.userData;

        console.log("User registered successfully with referral code:", referralCode);
        return res.status(200).json({
            success: true,
            message: "User registered successfully",
            redirectUrl: '/'
        });

    } catch (error) {
        console.error("Error during OTP verification:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Internal Server Error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


const loadresendotp = async (req, res) => {
    try {
        const { email } = req.session.userData;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        const otp = generateotp();
        req.session.changeotp = otp;  // new session for otp verification

        const emailSend = await sendVerificationEmail(email, otp);

        if (emailSend) {
            
            return res.status(200).json({ success: true, message: "OTP resent successfully" });
        } else {
            return res.status(500).json({ success: false, message: "Failed to resend OTP" });
        }

    } catch (error) {
        console.log("Error resending OTP:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error, please try again" });
    }
};

const loadforgotpasword= async(req,res)=>{
    res.render("forgotpassword")
}

const changePassword = async (req, res) => {
    try {
        // Get the email from the request body
        const { email } = req.body;
        req.session.email=email 
        // Find the user by email
        const usermail = await User.findOne({ email });

        // If the user is not found
        if (!usermail) {
            return res.status(404).json({ message: "User not found" });
        }

        // Generate OTP
        const otp = generateotp();

        // Store OTP in session (Ensure session is properly configured)
        req.session.changeOtp = otp;

        // Send OTP to the user's email
        const emailSend = await sendVerificationEmail(email, otp);

        // Check if the email was successfully sent
        if (emailSend) {
            console.log(otp);  // Log OTP for debugging
            // Render OTP input page (make sure the page "forgopasswordOtp" exists)
            return res.render("forgopasswordOtp");
        } else {
            return res.status(500).json({ success: false, message: "Failed to send OTP" });
        }
    } catch (error) {
        console.log("Error sending OTP:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error, please try again" });
    }
};



const loadforgopasswordOtp = (req, res) => {
    // Renders the page where OTP is entered (ensure this page exists)
    res.render("forgopasswordOtp");
};

const VerifychangemailOtp = async (req, res) => {
    console.log("Verify OTP");

    try {
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({ success: false, message: "OTP is required" });
        }

        // Convert the OTP to an integer (or you can just compare strings)
        const np = parseInt(otp, 10); // Use base 10 to ensure correct parsing

        // Debugging output
        console.log('OTP received:', np);

        // Compare OTP stored in session with the entered OTP
        if (np === req.session.changeOtp) {
            // OTP is correct, clear session OTP to prevent reuse
            req.session.changeOtp = null;

            console.log("OTP validated successfully");

            // You can now proceed to the password reset page or any other page
            return res.status(200).json({
                success: true,
                message: "OTP verified successfully",
                redirectUrl: '/newemail', // Redirect to the page where the user can change their password
            });
        } else {
            // OTP is incorrect
            console.log("Wrong OTP");
            return res.status(400).json({
                success: false,
                message: "Invalid OTP. Please try again.",
            });
        }
    } catch (error) {
        console.log("Error during OTP verification:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const loadnewpassword=(req,res)=>{

    try {
        
        res.render("newpassword")

    } catch (error) {

        res.redirect("/pageError")
        
    }

}


const changepassword=async (req,res)=>{
    try{
        const {password,confirm_password}=req.body
        if(password === confirm_password)
        {
            email=req.session.email
            const passwordHash = await securePassword(password);
            await User.updateOne(
                {email:email},
                {$set:{password:passwordHash}}
            );
            console.log("password match")
        }
        res.redirect("/signin")
    }
    catch(error)
    {
        res.redirect("/pageNotFound")
    }
}

const logout = async (req, res) => {
    try {
        if (req.session) {
            req.session.destroy((err) => {
                if (err) {
                    console.error('Logout Error:', err);
                    return res.status(500).send("Error logging out");
                }
                res.redirect("/signin"); // Redirect to login after logout
            });
        } else {
            res.redirect("/signin");
        }
    } catch (error) {
        console.error('Logout Error:', error);
        res.redirect('/error');
    }
};



const getProductLoader = async (req, res) => {
    try {
        const user = req.session.user;
        const item = req.query.item;
       
        const categories = await Category.find({ isListed: true });

        const productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 }
        })
        .populate('category', 'name image') // Populate category name & image
        .sort({ createdOn: -1 }) // Sort by newest
        .limit(4); // Get only the latest 4


        if (user) {
            const userData = await User.findById(user);
            if( item==categories.name && productData.category == categories._id)
            {
                return res.render('productloader', { user: userData, products: productData ,items:item,name:productData.productName});
            }
            return res.render('productloader', { user: userData, products: productData ,items:item,category:categories,name:productData.productName});
        } 

        res.render('productloader', { products: productData ,items:item,name:productData.productName});

    } catch (error) {
        console.error('Error loading home page:', error);
        res.status(500).send('Server Error');
    }
};

const getshop=async(req,res)=>{
    try {
        res.render("shop")
    } catch (error) {
        
    }
}
const loadShoppingPage = async (req, res) => {
    try {
        // Get user data if authenticated
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;
        
        // Default category ID from query parameter or set winter collection as default
        let requestedCategoryId;
        try {
            requestedCategoryId = req.query.category ? 
                new ObjectId(req.query.category) : 
                new ObjectId('67c547d22b720e19dfc14bf3');
        } catch (error) {
            console.error("Invalid ObjectId format:", error);
            requestedCategoryId = new ObjectId('67c547d22b720e19dfc14bf3'); // Default to winter collection
        }
        
        // Pagination setup
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Get all listed categories with product counts
        const categoriesWithCounts = await Category.aggregate([
            {
                $match: { isListed: true }
            },
            {
                $lookup: {
                    from: 'products',
                    let: { categoryId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$category', '$$categoryId'] },
                                        { $eq: ['$isBlocked', false] },
                                        { $gt: ['$quantity', 0] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'products'
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    productCount: { $size: '$products' },
                    categoryOffer: 1
                }
            }
        ]);

        console.log("Listed categories:", categoriesWithCounts.map(c => ({ id: c._id, name: c.name })));

        // Check if requested category is listed
        const requestedCategory = await Category.findOne({ 
            _id: requestedCategoryId, 
            isListed: true 
        });

        console.log("Requested category found:", requestedCategory ? "Yes" : "No");
        
        // If requested category isn't listed or doesn't exist, use the first listed category
        let activeCategoryId;
        if (!requestedCategory && categoriesWithCounts.length > 0) {
            activeCategoryId = categoriesWithCounts[0]._id;
            console.log("Using first available category:", activeCategoryId);
        } else if (requestedCategory) {
            activeCategoryId = requestedCategoryId;
            console.log("Using requested category:", activeCategoryId);
        } else {
            activeCategoryId = null;
            console.log("No active category found");
        }

        // If no active categories exist
        if (!activeCategoryId && categoriesWithCounts.length === 0) {
            console.log("No active categories available");
            return res.render("shop", {
                user: userData,
                products: [],
                category: [],
                totalProducts: 0,
                currentPage: page,
                totalPages: 0,
                search: req.query.search,
                sort: req.query.sort,
                priceFrom: 1,
                priceTo: 2000,
                req: req,
                message: "No active categories found"
            });
        }

        // Build query object
        let query = {
            isBlocked: false,
            quantity: { $gt: 0 }
        };
        
        // Add category filter only if we have a valid category
        if (activeCategoryId) {
            query.category = activeCategoryId;
        }

        console.log("Product query:", JSON.stringify(query));

        // Add search functionality
        if (req.query.search) {
            query.productName = { $regex: req.query.search, $options: 'i' };
        }

        // Price range filter
        const priceFrom = parseInt(req.query['price-from']) || 1;
        const priceTo = parseInt(req.query['price-to']) || 2000;
        query.salePrice = { $gte: priceFrom, $lte: priceTo };

        // Determine sort order
        let sort = {};
        switch (req.query.sort) {
            case 'popularity':
                sort = { popularity: -1 };
                break;
            case 'price_asc':
                sort = { salePrice: 1 };
                break;
            case 'price_desc':
                sort = { salePrice: -1 };
                break;
            case 'rating':
                sort = { averageRating: -1 };
                break;
            case 'featured':
                sort = { featured: -1 };
                break;
            case 'new':
                sort = { createdAt: -1 };
                break;
            case 'name_asc':
                sort = { productName: 1 };
                break;
            case 'name_desc':
                sort = { productName: -1 };
                break;
            default:
                sort = { createdAt: -1 };
        }

        // Test query by getting simple count first
        const simpleCount = await Product.countDocuments(query);
        console.log(`Simple query returned ${simpleCount} products`);

        // Fetch products with applied filters
        const products = await Product.aggregate([
            {
                $match: query
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'categoryDetails'
                }
            },
            {
                $unwind: {
                    path: '$categoryDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    productName: 1,
                    description: 1,
                    category: 1,
                    categoryName: '$categoryDetails.name',
                    categoryDescription: '$categoryDetails.description',
                    categoryOffer: '$categoryDetails.categoryOffer',
                    regularPrice: 1,
                    salePrice: 1,
                    quantity: 1,
                    size: 1,
                    color: 1,
                    productImage: 1,
                    isBlocked: 1,
                    brand: 1,
                    status: 1,
                    productOffer: 1,
                    bestOffer: 1,
                    ratings: 1,
                    createdAt: 1
                }
            },
            {
                $sort: sort
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            }
        ]);

        console.log(`Found ${products.length} products after aggregation`);
        
        // If no products found, try fallback to any listed category
        if (products.length === 0 && categoriesWithCounts.length > 0) {
            console.log("No products found for selected category, trying fallback...");
            
            // Find the first category that actually has products
            for (const cat of categoriesWithCounts) {
                if (cat.productCount > 0) {
                    console.log(`Falling back to category ${cat.name} with ${cat.productCount} products`);
                    // Update query with new category
                    query.category = cat._id;
                    break;
                }
            }
            
            // Try fetching products again with updated category
            const fallbackProducts = await Product.aggregate([
                { $match: query },
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'category',
                        foreignField: '_id',
                        as: 'categoryDetails'
                    }
                },
                {
                    $unwind: {
                        path: '$categoryDetails',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        productName: 1,
                        description: 1,
                        category: 1,
                        categoryName: '$categoryDetails.name',
                        categoryDescription: '$categoryDetails.description',
                        categoryOffer: '$categoryDetails.categoryOffer',
                        regularPrice: 1,
                        salePrice: 1,
                        quantity: 1,
                        size: 1,
                        color: 1,
                        productImage: 1,
                        isBlocked: 1,
                        brand: 1,
                        status: 1,
                        productOffer: 1,
                        bestOffer: 1,
                        ratings: 1,
                        createdAt: 1
                    }
                },
                { $sort: sort },
                { $skip: skip },
                { $limit: limit }
            ]);
            
            if (fallbackProducts.length > 0) {
                console.log(`Found ${fallbackProducts.length} products in fallback category`);
                products = fallbackProducts;
                activeCategoryId = query.category;
            }
        }

        // Get total products and pages
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        console.log(`Total products: ${totalProducts}, Total pages: ${totalPages}`);

        // Render the shop page with necessary data
        res.render("shop", {
            user: userData,
            products: products,
            category: categoriesWithCounts,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: totalPages,
            search: req.query.search,
            sort: req.query.sort,
            priceFrom: priceFrom,
            priceTo: priceTo,
            req: req,
            activeCategory: activeCategoryId
        });

    } catch (error) {
        console.error("Error loading shopping page:", error);
        res.status(500).redirect("/pageNotFound");
    }
};

const filterProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const category = req.query.category;
        const priceFrom = req.query["price-from"] || 1;  // Set default value for priceFrom
        const priceTo = req.query["price-to"] || 2000;  // Set default value for priceTo

        // console.log("Received Filters:", { category, priceFrom, priceTo }); // Debugging

        const findCategory = category ? await Category.findOne({ _id: category }) : null;
        
        const query = {
            isBlocked: false,
            quantity: { $gt: 0 }
        };

        if (findCategory) {
            query.category = findCategory._id;
        }

        if (priceFrom && priceTo) {
            query.price = { $gte: Number(priceFrom), $lte: Number(priceTo) };
        }

        // console.log("Final Query to DB:", query); // Debugging

        let findProducts = await Product.find(query).lean();
        // console.log("Found Products:", findProducts); // Debugging

        findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

        const categories = await Category.find({ isListed: true });
        const categoriesWithCounts = await Promise.all(categories.map(async (category) => {
            const count = await Product.countDocuments({
                category: category._id,
                
                quantity: { $gt: 0 }
            });
            return { _id: category._id, name: category.name, productCount: count };
        }));

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProduct = findProducts.slice(startIndex, endIndex);

        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user });
        }
       
        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categoriesWithCounts,
            totalPages,
            currentPage,
            selectedCategory: category || null,
            selectedPriceFrom: priceFrom,  // Pass priceFrom
            selectedPriceTo: priceTo      // Pass priceTo
        });

    } catch (error) {
        console.error("Error in filtering:", error);
        res.redirect("/pageNotFound");
    }
};

const getRefferalPage=async(req,res)=>{
    try {
        const user=req.session.user
        
        res.render("reffer",{userDetails:user,user:user})
    } catch (error) {
        res.render('error')
    }
   
}
const getWalletPage=async(req,res)=>{
    try {
        const user = req.session.user;
        const bal = await User.findOne({ _id: user._id });
        
        // Pagination settings
        const page = parseInt(req.query.page) || 1;  // Get the page number from query params (default is page 1)
        const limit = 10;  // Number of transactions per page
        
        // Fetch transactions with pagination
        const transactions = await Transaction.find({userId:user._id    })
        .sort({ date: -1 }) // Sort in reverse order based on 'createdAt' (most recent first)
        .skip((page - 1) * limit) // Skip the transactions from previous pages
        .limit(limit); // Limit the number of transactions per page
    
        // Count total transactions for pagination
        const totalTransactions = await Transaction.countDocuments();

        // Calculate total number of pages
        const totalPages = Math.ceil(totalTransactions / limit);

        // Send the data to the front-end, including pagination data
        res.render("wallet", {
            bal: bal.wallet,
            transactions,  // Transaction data for the current page
            user,
            totalPages,    // Total number of pages
            currentPage: page,  // Current page number
        });

    } catch (error) {
        res.render('error');
    }
   
}

const getmycouponspage = async (req, res) => {
    try {
        const { ObjectId } = require('mongodb'); // Import ObjectId
        // Fetch coupons and referral coupons from the database
        const coupons = await Coupon.find({});
        const refCoupons = await ReferralCoupon.find({});
        
        const user = req.session.user;  // Assume this comes from session
        const userId = user._id;  
        const userObjectId = new ObjectId(userId);

        console.log("id = ",userObjectId)
        // Now you can compare ObjectId with ObjectId
if (userObjectId.equals(refCoupons[0].owner)) {
    console.log('Match found!');
  } else {
    console.log('No match');
  }
        // Render the myCoupons page, passing the filtered referral coupons and the other data
        res.render("myCoupons", { coupon: coupons, refCoupons: refCoupons, user: user,userId:userObjectId});
    } catch (error) {
        // Log the error for debugging purposes
        console.error(error);
        
        // Render an error page and pass a custom error message to the view
        res.render('error', { message: 'An error occurred while fetching your coupons. Please try again later.' });
    }
}



module.exports = { 
    loadHomePage,
    pageNotFound,
    loadSignin,
    loadSignup,
    loadRegister,
    loadverifyotp,
    loadresendotp,
    loadEnter,
    loadforgotpasword,
    changePassword,
    loadforgopasswordOtp,
    VerifychangemailOtp,
    loadnewpassword,
    changepassword,
    loadHomePage,
    loadSignUpPage,
    logout,
    getProductLoader,
    getshop,
    loadShoppingPage,
    filterProduct,
    getRefferalPage,
    getWalletPage,
    getmycouponspage,
changeEmailValid,
changeEmailOtp,
  
}