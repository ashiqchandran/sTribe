document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const format = document.getElementById('format').value;
    
    try {
      const response = await fetch(`/download-orders?startDate=${startDate}&endDate=${endDate}&format=${format}`);
      
      if (!response.ok) throw new Error('Failed to generate report');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-report.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error(error);
      alert('Error generating report: ' + error.message);
    }
  });