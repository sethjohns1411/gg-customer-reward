// pages/api/webhooks/orders/create.js
const nodemailer = require('nodemailer');
const axios = require('axios');

// ... (previous code)

// Function to fetch product data
async function fetchProductData(productId) {
  const apiUrl = `${process.env.STORE_URL}admin/api/${process.env.SHOPIFY_API_VERSION}/products/${productId}.json`;
  
  try {
    const response = await axios.get(apiUrl, {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_API_KEY,
      },
    });
    
    if (response.status !== 200) {
      throw new Error(`Failed to fetch product data: ${response.statusText}`);
    }

    return response.data.product;
  } catch (error) {
    console.error(`Error fetching product data: ${error.message}`);
    return null;
  }
}

const transporter = nodemailer.createTransport({
  service: 'Gmail', // e.g., 'Gmail'
  auth: {
    user: process.env.EMAIL_USERNAME, // Your email username
    pass: process.env.EMAIL_PASSWORD, // Your email password
  },
});

const cellStyle = `
<style>
  .table-cell {
    padding: 15px;
    border: 1px solid #ccc;
  }
  h4{
    margin-bottom: 8px;
  }
  h6{
    margin-bottom: 4px;
  }
  p{
    margin:0;
    font-size: 14px;
  }

  .address-item h4{
    border-bottom: 1px solid #ccc;
    padding: 15px;
    margin: 0;
  }
  .address-item p{
    margin-bottom: 4px;
  }
  .px-15{
    padding-left: 15px;
    padding-right: 15px;
  }
  .py-15{
    padding-top: 15px;
    padding-bottom: 15px;
  }
</style>
`;


export default async (req, res) => {
  const order = req.body;
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }
  try {

    let propExist = false;

    for(let j=0; j<order.line_items.length; j++){
      let item = order.line_items[j];
      for(let i=0;i<item.properties.length;i++){
        let prop = item.properties[i];
        // console.log('prop',prop);
        if((prop?.name == 'Order Date' && prop?.value != "") || (prop?.name == 'from' && prop?.value != "")){
          propExist = true;
        }
      }
      // if(item.properties[''])
    }

     const lineItemPromises = order.line_items.map(async (item) => {
      const product = await fetchProductData(item.product_id);
      if (!product) {
        // Handle the case where product data couldn't be fetched
        return ''; // Return an empty string or handle the error gracefully
      }
      let image = product.image.src
      let variant = product.variants.find((item)=> item.id == item.variant_id);
      if(variant){
        if(variant.image_id){
          let img = product.images.find((itemImg)=> itemImg == variant.image_id);
          if(img){
            image = img;
          }
        }
      }
      
      return `
        <tr>
          <td><img style="width: 100px; max-width: 100%; height: auto;" src="${image}" alt="${item.title}" class="item-image"></td>
          <td>
            <h4>${item.title}</h4>
            <h6>${item.variant_title != "Default Title" ? item.variant_title : ''}</h6>
            ${item.properties.map((prop) => `
            <span>${prop.name}:${prop.value}</span><br/>
            `).join('')}
          </td>
          <td>${item.sku}</td>
          <td>${item.quantity}</td>
          <td>${item.price}</td>
        </tr>
      `;
    });

    
    const lineItemHtml = await Promise.all(lineItemPromises);

    const shippingAddressHtml = `<div class="address-item" style="display:inline-block; border-right:1px solid #ccc;">
    <h4 style="padding-left: 15px; padding-right: 15px;"><b>Shipping Address</b></h4>
    <div class="px-15 py-15" style="padding-left: 15px; padding-right: 15px;">
    <p><b>Name:</b> ${order.shipping_address.name}</p>
    <p><b>Address:</b> ${order.shipping_address.address1}, ${order.shipping_address.address2}</p>
    <p><b>City:</b> ${order.shipping_address.city}</p>
    <p><b>Province:</b> ${order.shipping_address.province}</p>
    ${order.shipping_address.zip ? <p><b>Zip Code:</b> ${order.shipping_address.zip}</p> :'' }
    <p><b>Country:</b> ${order.shipping_address.country}</p>
    <p><b>Phone Number</b>: ${order.shipping_address.phone}</p></div></div>
  `;

  const billingAddressHtml = `<div class="address-item" style="display:inline-block;">
    <h4 style="padding-left: 15px; padding-right: 15px;"><b>Billing Address</b></h4>
    <div class="px-15 py-15" style="padding-left: 15px; padding-right: 15px;">
    <p><b>Name:</b> ${order.billing_address.name}</p>
    <p><b>Address:</b> ${order.billing_address.address1}, ${order.billing_address.address2}</p>
    <p><b>City:</b> ${order.billing_address.city}</p>
    <p><b>Province:</b> ${order.billing_address.province}</p>
    ${order.billing_address.zip ? <p><b>Zip Code:</b> ${order.billing_address.zip}</p> :'' }
    <p><b>Country:</b> ${order.billing_address.country}</p>
    <p><b>Phone Number</b>: ${order.billing_address.phone}</p></div></div>
  `;
    const lineItemsTable = `
    ${cellStyle}
    <p><b>Order Number</b>: ${order.name} </p>
    <p><b>Customer Name</b>: ${order.shipping_address.name}</p>
    <p><b>Email</b>: ${order.customer.email}</p>
    <div class="address-item-wrapper"  style="margin-top: 15px;display:inline-block; border:1px solid #ccc;">
    ${shippingAddressHtml}
    ${billingAddressHtml}
    </div>
    <h4>Line Items:</h4>
    <table border="1"  class="table-cell" cellpadding="15"  style="width: 450px; max-width:100%; border-collapse: collapse; border-color: #ccc;">
      <tr>
        <th>Image</th>
        <th>Name</th>
        <th>Code</th>
        <th>Quantity</th>
        <th>Price</th>
      </tr>
      ${lineItemHtml.join('')}
    </table>
    `;

        // console.log("lineItemsTable",lineItemsTable);
    // res.status(200).end('Webhook received successfully');

  

    // Create an email with line items and send it
    const mailOptions = {
      from: process.env.EMAIL_USERNAME, // Sender's email address
      to: 'info@blommadubai.com',
      // to: 'siddarth@visamoda.com', // Recipient's email address
      // to: 'harshad@lucentinnovation.com', 
      subject: 'Order Line Items',
      // Use lineItemsTable in the HTML part of your email content
      html: `
      
      ${lineItemsTable}
    `,
    };
    if(propExist){
      await transporter.sendMail(mailOptions);
    }
    res.status(200).end('Webhook received successfully');
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).end('Internal Server Error');
  }
};
