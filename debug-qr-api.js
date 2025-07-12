const testQRAPI = async () => {
  try {
    console.log('🔍 Testing QR API response structure...');
    
    const response = await fetch('https://mcp.profullstack.com/tools/qr-generator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'https://www.amazon.com/dp/B0CPZKLJX1?tag=test-20',
        size: 250,
        errorCorrectionLevel: 'M',
      }),
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📊 Response body (first 500 chars):', responseText.substring(0, 500));
    
    try {
      const jsonResponse = JSON.parse(responseText);
      console.log('📊 Parsed JSON structure:', JSON.stringify(jsonResponse, null, 2));
    } catch (parseError) {
      console.log('❌ Failed to parse as JSON:', parseError.message);
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
};

testQRAPI();