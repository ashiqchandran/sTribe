const User =require("../../models/userSchema")
const mongoose =require("mongoose");
const bcrypt=require("bcrypt");


const adminLogin = (req,res)=>{    
  try {
        res.render("adminhome");
  
  } catch (error) {
    console.log("error")
  }
}
const adminsignin = async (req, res) => {   
    try {
        console.log("Admin login attempt"); // Log to confirm the function is being triggered
        const { email, password } = req.body;
        console.log("Received email:", email); // Log email
        console.log("Received password:", password); // Log password

        // Check if email or password is empty
        if (!email || !password) {
            console.log("Email or password is missing");
            return res.redirect('/adminhome'); // Or send an error message
        }

        // Find user in the database
        const user = await User.findOne({ email });
        console.log("User found:", user); // Log the user object

        if (!user) {
            console.log("User not found");
            return res.redirect('/adminhome'); // User doesn't exist
        }

        // Compare password
        const passwordMatch = await bcrypt.compare(password, user.password);
        console.log("Password match result:", passwordMatch); // Log password comparison result

        if (passwordMatch) {
            if (user.isAdmin) {
                console.log("Admin logged in");
                console.log("Admin name: ", user.fullname); // Log to check the admin's name
                req.session.admin = user._id;
                res.render('dashboard', { adminName: user.fullname });
                // Correct rendering path
            } else {
                console.log("User is not an admin");
                return res.status(401).send("Invalid credentials or not an admin");
            }
        } else {
            console.log("Invalid password");
            return res.redirect('/adminhome');  // Redirect to login page or show error message
        }

    } catch (error) {
        console.error("Error during sign-in:", error); // Log the error message to the console
        return res.redirect("/pageError");
    }
};





const adminDashboard=(req,res)=>{
    if(req.session.admin)
    {
        try {
            res.render("dashboard",) // no need to pass here admin name just for login (get) if admiin is already logged in
        } catch (error) {
            console.log("dashboard error")
        }
    }
    
}

const adminLogout=async(req,res)=>{
    try{
        req.session.destroy(err=>{
            if(err){
                console.log("Error session Destroying",err)
                return res.redirect("/pageError")
            }
            res.redirect("/admin/login")
        })
    }catch(error){
        console.log("unexpected error happend during transaction",error)
        res.redirect("/pageError")
    }
}

const  pageError_404=(req,res)=>{
    res.render("pageError")         
}
// const admindata=async(req,res)=>{
//     if(req.session.admin)
//     {
//         res.send({message:req.session.admin})
//     }
// }

module.exports={
    adminLogin,
    adminsignin,
    adminDashboard,
    pageError_404,
    adminLogout
}