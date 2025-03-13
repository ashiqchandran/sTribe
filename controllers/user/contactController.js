

const getContactPage=(req,res)=>{
try {
    res.render("contacts")
} catch (error) {
    res.render(error)
}
}

module.exports={
    getContactPage
}