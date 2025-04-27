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
        const checkoutAdd=req.query
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
        
           return res.redirect("/checkout")
       
       
        

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
        const userId = req.session.user._id;
        console.log("userId = ", userId);
        
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated.' });
        }

        const { name, username, phone } = req.body;
        console.log("Request data:", { name, username, phone });

        // Create update object with only provided fields
        const updateData = {};
        
        if (name !== undefined) {
            updateData.fullname = name;
        }
        
        if (username !== undefined) {
            // Check if username already exists (except for current user)
            const existingUser = await User.findOne({ 
                username, 
                _id: { $ne: userId } 
            });
            
            if (existingUser) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Username is already taken.' 
                });
            }
            updateData.username = username;
        }
        
        if (phone !== undefined) {
            // Validate phone number format
            if (!/^\d{10}$/.test(phone)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Please enter a valid 10-digit phone number' 
                });
            }
            
            // Check if phone number is already in use
            const phoneExists = await User.findOne({ 
                phone, 
                _id: { $ne: userId } 
            });
            
            if (phoneExists) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Phone number already in use by another account' 
                });
            }
            
            updateData.phone = phone;
        }

        // If no valid fields to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No valid fields provided for update' 
            });
        }

        // Update user profile with only the provided fields
        const updatedUser = await User.findByIdAndUpdate(
            userId, 
            updateData, 
            { 
                new: true, 
                runValidators: true,
                select: '-password -isAdmin -isBlocked' // Exclude sensitive fields
            }
        );

        if (!updatedUser) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Profile updated successfully',
            user: updatedUser 
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error',
                errors: messages 
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'An error occurred while updating your profile',
            error: error.message 
        });
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


const addProfile =  async (req, res) => {
    try {
        const userId = req.params.id;
        const imagePath = `/uploads/profile/${req.file.filename}`; // Save the relative path
        console.log(imagePath)
        // Update user in database
        await User.findByIdAndUpdate(userId, { image: imagePath });
  
        res.json({ success: true, imagePath });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error uploading image' });
    }
  }
  
  
module.exports={
    getprofile,
    loadAddressPage,
    addAddress,
    postAddAddress,
    postEditAddress,
    editAddress,
    deleteAddress,
    updateProfile,
updateEmail ,
 verifyEmailOtp ,
   changeEmailValid  ,
   changeEmail,
   addProfile

}