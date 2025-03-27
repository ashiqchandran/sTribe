const User=require('../../models/userSchema')
const Category=require("../../models/categorySchema")
const Product=require("../../models/productSchema")
const Cart = require("../../models/cartSchema")

const nodemailer=require("nodemailer")
const bcrypt = require("bcrypt")
const env =require("dotenv").config()
const saltround = 10

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
        

        // Render the home page and pass the user details, products, and top sellers to the view
        
        res.render('home', {
            user: userData,               // Passing the user details (if logged in)
            products: productData,        // Passing the latest products
            topSeller: mostsellingProduct // Passing the most selling products
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
        res.render("page-404")
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
        const {fullname,email,phone,password}=req.body

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
        req.session.userData={fullname,phone,email,password}        
        console.log("otp send",otp)
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
const loadverifyotp = async (req, res) => {
    console.log("Verify OTP");

    try {
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({ success: false, message: "OTP is required" });
        }

        const np = parseInt(otp);
        console.log('OTP received');

        if (np === req.session.userotp) {
            const user = req.session.userData;
            if (!user) {
                return res.status(400).json({ success: false, message: "User data not found in session" });
            }

            const passwordHashed = await securePassword(user.password);

            const saveUserData = new User({
                fullname: user.fullname,
                phone: user.phone,
                email: user.email,
                googleId: user.googleId ||  Math.floor(Math.random() * 100000),
                password: passwordHashed,
            });

            await saveUserData.save();
            req.session.user = saveUserData._id;
            console.log("User data saved");

            // Send response back to the client before rendering
            return res.status(200).json({
                success: true,
                message: "User registered successfully",
                redirectUrl: '/', // You can send a URL or just render the page on client-side
            });
        } else {
            console.log("Wrong OTP");
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

    } catch (error) {
        console.log("Error during OTP verification:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
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

        // Pagination setup
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Build query object
        let query = {
            isBlocked: false,
            quantity: { $gt: 0 }
        };

        // Add search functionality
        if (req.query.search) {
            query.productName = { $regex: req.query.search, $options: 'i' };
        }

        // Price range filter (optional)
        const priceFrom = parseInt(req.query['price-from']) || 1; // Default: 1
        const priceTo = parseInt(req.query['price-to']) || 2000; // Default: 2000
        query.salePrice = { $gte: priceFrom, $lte: priceTo }; // Apply price range filter

        // Get categories and ensure they're listed
        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map(category => category._id);
        query.category = { $in: categoryIds };

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

        // Get categories with product counts
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
                    productCount: { $size: '$products' }
                }
            }
        ]);

        // Fetch products with applied filters
        const products = await Product.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit);

        // Get total products and pages
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

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
            priceFrom: priceFrom, // Send back priceFrom to retain the value in the filter input
            priceTo: priceTo, // Send back priceTo to retain the value in the filter input
            req: req
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

        console.log("Received Filters:", { category, priceFrom, priceTo }); // Debugging

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

        console.log("Final Query to DB:", query); // Debugging

        let findProducts = await Product.find(query).lean();
        console.log("Found Products:", findProducts); // Debugging

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
        res.render("reffer")
    } catch (error) {
        res.render('error')
    }
   
}
const getWalletPage=async(req,res)=>{
    try {
      
            res.render("wallet")

    } catch (error) {
        res.render('error')
    }
   
}
const getmycouponspage= async (req,res)=>{
    try {
        const user = req.session.user;
        
        res.render("myCoupons",{user:user})
    } catch (error) {
        res.render('error')
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
    getmycouponspage
  
}