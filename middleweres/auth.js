const User=require("../models/userSchema")
const userAuth=(req,res,next)=>{
    if(req.session.user)
    {
        User.findById(req.session.user)
        .then((data)=>{
            if(data && !data.isBlocked)
            {
                next()
            }
            else{
                res.redirect("/login")
            }
        })
        .catch((error)=>
        {
            console.log("Error in user auth middlewere")
            res.status(500).send("Internal Server Error")
        
    })
}
    
    }


const adminAuth=(req,res,next)=>{
    User.findById(req.session.admin)
        .then(data=>{
            if(data && data.isAdmin)
            {
                next();
            }
            else{
                res.redirect("/admin/login")

            }
        })
        .catch(error=>{
            console.log("Error in  Admin Auth middlewere",error);
            res.status(500).send("Internal Server Error")
        })
        
    }
    module.exports={
        userAuth,
        adminAuth
    }