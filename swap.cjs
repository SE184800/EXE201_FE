const fs = require('fs');
const file = 'src/pages/StoreInventory.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<button className="edit-product".*?<\/button><button className="dash-primary".*?Xuất bán<\/button>/;
const match = content.match(regex);
console.log("Matched text:", match ? match[0] : "Not found");

if(match) {
  // We'll flip them so Xuất Bán is first, and edit is second.
  const editBtn = match[0].match(/<button className="edit-product".*?<\/button>/)[0];
  const sellBtn = match[0].match(/<button className="dash-primary".*?Xuất bán<\/button>/)[0];
  
  // Clean up margins inside sellBtn
  let newSellBtn = sellBtn.replace(/marginLeft: "12px", /, '');
  
  // Add margin to edit btn
  let newEditBtn = editBtn.replace('className="edit-product"', 'className="edit-product" style={{marginLeft: "12px"}}');

  content = content.replace(match[0], newSellBtn + newEditBtn);
  fs.writeFileSync(file, content);
  console.log("Successfully swapped buttons.");
}

