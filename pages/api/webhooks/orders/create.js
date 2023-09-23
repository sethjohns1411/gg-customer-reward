// pages/api/webhooks/orders/create.js
const nodemailer = require('nodemailer');
const axios = require('axios');

// ... (previous code)


// product.metafields.custom.customer_reward
// Function to fetch product data

async function ajaxMethod(apiUrl) {
  try {
    const response =  await axios.get(apiUrl, {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_API_KEY,
      },
    });

    if (response.status !== 200) {
      throw new Error(`Failed to fetch product data: ${response.statusText}`);
    }
    return response;
  }
  catch (error) {
    console.error(`Error fetching product data: ${error.message}`);
    return null;
  }
}


async function fetchProductData(productId) {
  const apiUrl = `${process.env.STORE_URL}admin/api/${process.env.SHOPIFY_API_VERSION}/products/${productId}/metafields.json`;
  const response = await ajaxMethod(apiUrl)
  let value = 0;
  if (response?.data?.metafields) {
    let meta = response.data.metafields.find((item) => item.namespace == "custom" && item.key == "customer_reward");
    if (meta) {
      value = meta.value;
    }
  }
  return value;
}



export default async (req, res) => {
  const order = req.body;
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }
  const headers = {
    'X-Shopify-Access-Token': process.env.SHOPIFY_API_KEY,
  };
  let finalCount = 0;
  const orderApiUrl = `${process.env.STORE_URL}admin/api/${process.env.SHOPIFY_API_VERSION}/customers/${order.customer.id}/metafields.json`;
  

  try {
    const lineItemPromises = order.line_items.map(async (item) => {
      const product = await fetchProductData(item.product_id);
      finalCount = finalCount + product;
      return product;
    });


    const lineItemHtml = await Promise.all(lineItemPromises);

    const response = await ajaxMethod(orderApiUrl);
    if (response?.data?.metafields) {
      let meta = response.data.metafields.find((item) => item.namespace == "custom" && item.key == "customer_reward");
      console.log("meta",response.data.metafields)
      if (meta) {
        finalCount = finalCount + meta.value;

        const updatedMetafieldData = {
          value: finalCount, // Replace with the new value for the metafield
        };
        console.log("updatedMetafieldData",updatedMetafieldData);
        const updateMetafieldUrl = `${process.env.STORE_URL}admin/api/${process.env.SHOPIFY_API_VERSION}/customers/${order.customer.id}/metafields/${meta.id}.json`;
        const updateResponse = await axios.put(updateMetafieldUrl, { metafield: updatedMetafieldData }, { headers });
      }else{
        const createMetafieldUrl = `${process.env.STORE_URL}admin/api/${process.env.SHOPIFY_API_VERSION}/customers/${order.customer.id}/metafields.json`;
        const createResponse = await axios.post(createMetafieldUrl, { metafield: { key: "customer_reward", value: finalCount, namespace: 'custom' } }, { headers });
        console.log('Metafield created successfully', createResponse.data);
      }
    }

    res.status(200).end('Webhook received successfully');
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).end('Internal Server Error');
  }
};
