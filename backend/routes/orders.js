const express = require('express');
const axios = require('axios');
const { authenticateToken } = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * GET /api/orders
 * Return a list of orders from the SAP system.  Uses the SAP_API_BASE_URL
 * environment variable to call the SAP API.  Replace the example implementation
 * with real SAP integration (e.g., via SAP BTP, OData or REST APIs) and handle
 * authentication (OAuth2 client credentials / SAML etc.) as required.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Example: call SAP API endpoint to get orders (replace with real call).
    const sapUrl = `${process.env.SAP_API_BASE_URL}/orders`;
    // Provide necessary authentication headers for SAP here (e.g., Basic Auth, OAuth token).
    const response = await axios.get(sapUrl, {
      headers: {
        // 'Authorization': 'Bearer <SAP_ACCESS_TOKEN>'
      }
    });
    // Forward the data directly.  In this example, we assume the API returns an array.
    return res.json(response.data);
  } catch (err) {
    console.error('Error fetching orders from SAP:', err.message);
    // Fallback: return demo data when SAP is unavailable.
    const demoOrders = [
      { id: 'SO1001', customer: 'ABC Corp', status: 'Processing', total: 123.45 },
      { id: 'SO1002', customer: 'XYZ Ltd', status: 'Shipped', total: 987.65 }
    ];
    return res.json(demoOrders);
  }
});

module.exports = router;