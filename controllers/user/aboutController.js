
const getAboutPage =(req,res)=>{
    try {
        res.render("about")
        
    } catch (error) {
        res.render(error)
        
    }

}
module.exports={
    getAboutPage
}