const User=require('../../models/userSchema')
const Category=require("../../models/categorySchema")
const Product=require("../../models/productSchema")
const Address=require("../../models/addressSchema")
const bcrypt = require("bcrypt")

const getprofile = async (req, res) => {
    try {
        const user = req.session.user;
        const categories = await Category.find({isListed:true})
        let productData = await Product.find({
            isBlocked:false,
            category:{$in:categories.map(category=>category._id)},
            quantity:{$gt:0},
        })

        productData.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt))
        productData = productData.slice(0,12);


        if(user){
            const userData = await User.findOne({_id:user});
            res.render('profile',{user:userData, products:productData})
            
            
        } else{
            return res.render('profile',{products:productData,req:req})
        }
            
        
    } catch (error) {
        console.log('Home Page Not Found')
        res.status(500).send('Server Error')
    }
}
const loadAddressPage = async (req,res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const addressData = await Address.findOne({userId:userId})
        
        res.render("address",{
            user:userData,
            userAddress:addressData,

        })

    } catch (error) {

        console.error("Error in Address loading",error);
        res.redirect("/pageNotFound");
        
    }
}

const addAddress = async (req,res) => {
    try {
        
        const user = req.session.user;
        const userData = await User.findById(user);
        res.render("add-address",{
            
            theUser:user,
            user:userData
        })

    } catch (error) {

        res.redirect("/pageNotFound")
        
    }
}

const postAddAddress = async (req,res) => {
    try {
        
        const userId = req.session.user;
        const userData = await User.findOne({_id:userId})
        const { addressType, name, country, city, landMark, state, streetAddress, pincode, phone, email, altPhone } = req.body;

        const userAddress = await Address.findOne({userId:userData._id});
        
        if(!userAddress){
            const newAddress = new Address({
                userId:userData,
                address: [{addressType, name, country, city, landMark, state, streetAddress, pincode, phone, email, altPhone}]

            });
            await newAddress.save();
        }else{
            userAddress.address.push({addressType, name, country, city, landMark, state, streetAddress, pincode, phone, email, altPhone})
            await userAddress.save();
        }

        res.redirect("/address")

    } catch (error) {

        console.error("Error adding address",error)

        res.redirect("/pageNotFound")
        
    }
}

const editAddress = async (req,res) => {
    try {
        
        const addressId = req.query.id;
        const user = req.session.user;
        const currAddress = await Address.findOne({
            "address._id":addressId,

        });
        if(!currAddress){
            return res.redirect("/pageNotFound")
        }

        const addressData = currAddress.address.find((item) => {
            return item._id.toString() === addressId.toString();

        })

        if(!addressData){
            return res.redirect("/pageNotFound")
        }

        res.render("edit-address",{
            address:addressData,
            user:user
        })

    } catch (error) {

        console.error("Error in edit Address",error)
        res.redirect("/pageNotFound")
        
    }
}


const postEditAddress = async (req,res) => {
    try {

        const data = req.body;
        const addressId = req.query.id;
        const user = req.session.user;
        const findAddress = await Address.findOne({
            "address._id":addressId
        });
        if(!findAddress){
            res.redirect("/pageNotFound")
        }
        await Address.updateOne(
            {"address._id":addressId},
            {$set:{
                "address.$":{
                    _id:addressId,
                    addressType:data.addressType,
                    name:data.name,
                    country:data.country,
                    city:data.city,
                    landMark:data.landMark,
                    state:data.state,
                    streetAddress:data.streetAddress,
                    pincode:data.pincode,
                    phone:data.phone,
                    email:data.email,
                    altPhone:data.altPhone
                }
            }}
        )

        res.redirect("/address")
        
    } catch (error) {

        console.error("Error in editing address",error)
        res.redirect("/pageNotFound")
        
    }
}

const deleteAddress = async (req,res) => {
    try {
        
        const addressId = req.query.id;
        const findAddress = await Address.findOne({"address._id":addressId})

        if(!findAddress){
            return res.status(404).send("Address Not Found")
        }

        await Address.updateOne(
        {
            "address._id":addressId
        },
        {
            $pull: {
                address:{
                    _id:addressId,
                }
            }
        })

        res.redirect("/address")

    } catch (error) {

        console.error("Error in deleting in address",error)
        res.redirect("/pageNotFound")
        
    }
}

const updateProfile = async (req, res) => {
    try {
        const userId = req.session.user; // Ensure session stores only userId
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated.' });
        }

        const { name, username, phone } = req.body;

        // Validate phone number
        if (!/^\d{10}$/.test(phone)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit phone number' });
        }

        // Check if username already exists (except for the current user)
        const existingUser = await User.findOne({ username, _id: { $ne: userId } });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Username is already taken.' });
        }

        // Update user profile
        const updatedUser = await User.findByIdAndUpdate(userId, { name, username, phone }, { new: true, runValidators: true });

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, message: 'An error occurred while updating your profile' });
    }
};


const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = req.session.user; 

        console.log("User ID from session:", userId); // Debugging Log

        // Check if user is logged in
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in." });
        }

        // Fetch user from the database
        const user = await User.findById(userId);
        if (!user) {
            console.log("User not found in database"); // Debugging Log
            return res.status(404).json({ success: false, message: "User not found." });
        }

        console.log("User found:", user.email, "Password Exists:", !!user.password); // Debugging Log

        // Ensure user has a password (prevents Google login issues)
        if (!user.password) {
            console.log("User does not have a password (Google Login detected)"); // Debugging Log
            return res.status(400).json({ success: false, message: "Password cannot be changed for Google login users." });
        }

        // Compare passwords
        console.log("Comparing passwords...");
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        console.log("Password match result:", isMatch);

        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Current password is incorrect." });
        }

        // Validate new password
        if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters long and contain both letters and numbers." });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match." });
        }

        // Hash and update password
        console.log("Hashing new password...");
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        console.log("Password updated successfully!"); // Debugging Log

        res.json({ success: true, message: "Password changed successfully." });

    } catch (error) {
        console.error("Error changing password:", error); // Log the actual error
        res.status(500).json({ success: false, message: "An error occurred while changing the password." });
    }
};



const changeEmail = async (req, res) => {
    try {
        const userId = req.session.user; // Ensure session contains only userId
        if (!userId) {
            return res.redirect('/pageNotFound');
        }

        const userData = await User.findById(userId);
        res.render('change-email', { user: userData });

    } catch (error) {
        res.redirect('/pageNotFound');
    }
};


const changeEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const userExist = await User.findOne({ email });

        if (!userExist) {
            return res.render('change-email', { message: 'User with this email does not exist.' });
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            req.session.userOtp = otp;
            req.session.userdata = req.body;
            req.session.email = email;
            res.render('change-email-otp');
            console.log(`Email Sent: ${email}, OTP: ${otp}`);
        } else {
            res.json('email-error');
        }
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};



const verifyEmailOtp = async (req, res) => {
    try {
        const enteredOtp = String(req.body.otp);
        const sessionOtp = String(req.session.userOtp);

        if (enteredOtp === sessionOtp) {
            req.session.userData = req.body.userData;
            res.render('new-email', { userData: req.session.userData });
        } else {
            res.render('change-email-otp', { message: 'OTP does not match.', userData: req.session.userData });
        }
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};

const updateEmail = async (req, res) => {
    try {
        const newEmail = req.body.newEmail;
        const userId = req.session.user; // Ensure session contains only userId

        if (!userId) {
            return res.redirect('/pageNotFound');
        }

        await User.findByIdAndUpdate(userId, { email: newEmail });
        res.redirect('/userProfile');
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};

module.exports={
    getprofile,
    loadAddressPage,
    addAddress,
    postAddAddress,
    postEditAddress,
    editAddress,
    deleteAddress,
    updateProfile,
changePassword ,
updateEmail ,
 verifyEmailOtp ,
   changeEmailValid  ,
   changeEmail

}