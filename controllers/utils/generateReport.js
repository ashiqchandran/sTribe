// Example of the generateHTMLContent function
const generateHTMLContent = (salesData, totalProductsOrdered, totalAmountSpent, startDate, endDate, reportType) => {
  return `
      <html>
          <head>
              <title>Sales Report</title>
          </head>
          <body>
              <h1>Sales Report for ${reportType}</h1>
              <p>From: ${startDate} To: ${endDate}</p>
              <table border="1">
                  <tr>
                      <th>Product Name</th>
                      <th>Total Sales</th>
                      <th>Total Orders</th>
                      <th>Average Order Value</th>
                  </tr>
                  ${salesData.map(item => `
                      <tr>
                          <td>${item.productName}</td>
                          <td>${item.totalSales}</td>
                          <td>${item.totalOrders}</td>
                          <td>${item.averageOrderValue}</td>
                      </tr>
                  `).join('')}
              </table>
              <h3>Total Products Ordered: ${totalProductsOrdered}</h3>
              <h3>Total Amount Spent: ${totalAmountSpent}</h3>
          </body>
      </html>
  `;
};

module.exports = generateHTMLContent;
