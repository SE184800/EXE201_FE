const fs = require('fs');
const file = 'src/pages/StoreInventory.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'className="dash-link" style={{marginLeft: "8px"}}',
  'className="dash-primary" style={{marginLeft: "12px", padding: "4px 12px", fontSize: "12px", height: "auto", minHeight: "26px", fontWeight: "600"}}'
);

fs.writeFileSync(file, content);
