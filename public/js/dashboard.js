// admin-dashboard.js
document.addEventListener("DOMContentLoaded", () => {
    // Set event listeners for each menu item
    document.getElementById("dashboard").addEventListener("click", () => loadServiceContent("Dashboard"));
    document.getElementById("customer").addEventListener("click", () => loadServiceContent("Customer"));
    document.getElementById("category").addEventListener("click", () => loadServiceContent("Category"));
    document.getElementById("brand").addEventListener("click", () => loadServiceContent("Brand"));
    document.getElementById("add-product").addEventListener("click", () => loadServiceContent("Add Products"));
    document.getElementById("coupons").addEventListener("click", () => loadServiceContent("Coupons"));
    document.getElementById("banner").addEventListener("click", () => loadServiceContent("Banner"));
    document.getElementById("others").addEventListener("click", () => loadServiceContent("Others"));
});

function loadServiceContent(serviceName) {
    const serviceContent = document.getElementById("service-content");
    
    // Add content based on service
    switch (serviceName) {
        case "Dashboard":
            serviceContent.innerHTML = `<h2>Dashboard</h2><p>Here is the dashboard data...</p>`;
            break;
        case "Customer":
            serviceContent.innerHTML = `<h2>Customers</h2><p>Here is the customer data...</p>`;
            break;
        case "Category":
            serviceContent.innerHTML = `<h2>Category</h2><p>Here is the category data...</p>`;
            break;
        case "Brand":
            serviceContent.innerHTML = `<h2>Brand</h2><p>Here is the brand data...</p>`;
            break;
        case "Add Products":
            serviceContent.innerHTML = `<h2>Add Products</h2><p>Here is the add product form...</p>`;
            break;
        case "Coupons":
            serviceContent.innerHTML = `<h2>Coupons</h2><p>Here are the available coupons...</p>`;
            break;
        case "Banner":
            serviceContent.innerHTML = `<h2>Banner</h2><p>Here is the banner management...</p>`;
            break;
        case "Others":
            serviceContent.innerHTML = `<h2>Others</h2><p>Here is the other data...</p>`;
            break;
        default:
            serviceContent.innerHTML = `<h2>Welcome to the Admin Dashboard!</h2><p>Select a service from the sidebar to load the information.</p>`;
    }
}
