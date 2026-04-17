import { useState, useEffect, useCallback } from "react";

const CATEGORIES = ["All","Beverages","Snacks","Dairy","Canned Goods","Grains & Rice","Cleaning","Personal Care","Frozen / Cold Store","Confectionery","Household","Other"];

const SEED_PRODUCTS = [
  {id:"p1",name:"Coca-Cola 500ml",category:"Beverages",price:5,cost:3.5,quantity:48,minStock:10,unit:"bottle"},
  {id:"p2",name:"Malta Guinness",category:"Beverages",price:4,cost:2.8,quantity:36,minStock:10,unit:"can"},
  {id:"p3",name:"Indomie Noodles",category:"Snacks",price:2.5,cost:1.8,quantity:120,minStock:20,unit:"pack"},
  {id:"p4",name:"Peak Milk Tin",category:"Dairy",price:12,cost:9,quantity:24,minStock:6,unit:"tin"},
  {id:"p5",name:"Milo 400g",category:"Beverages",price:22,cost:17,quantity:8,minStock:5,unit:"tin"},
  {id:"p6",name:"Sardines (Geisha)",category:"Canned Goods",price:7,cost:5,quantity:5,minStock:8,unit:"tin"},
  {id:"p7",name:"Jasmine Rice 1kg",category:"Grains & Rice",price:8,cost:5.5,quantity:60,minStock:10,unit:"bag"},
  {id:"p8",name:"Key Soap",category:"Cleaning",price:3,cost:2,quantity:40,minStock:10,unit:"bar"},
  {id:"p9",name:"Ice Cream (vanilla)",category:"Frozen / Cold Store",price:6,cost:4,quantity:15,minStock:5,unit:"scoop"},
  {id:"p10",name:"Chewing Gum (Orbit)",category:"Confectionery",price:1.5,cost:1,quantity:3,minStock:10,unit:"pack"},
];

const GH = (n) => `GH₵ ${Number(n).toFixed(2)}`;
const uid = () => "x" + Math.random().toString(36).slice(2,10);
const today = () => new Date().toLocaleDateString("en-GB");

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [cart, setCart] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [payMethod, setPayMethod] = useState("Cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [saleHistoryDate, setSaleHistoryDate] = useState("");
  const [showProductDetail, setShowProductDetail] = useState(null);

  const showToast = (msg, type="success") => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    (async () => {
      try {
        const pRes = await window.storage.get("fm_products");
        const sRes = await window.storage.get("fm_sales");
        setProducts(pRes ? JSON.parse(pRes.value) : SEED_PRODUCTS);
        setSales(sRes ? JSON.parse(sRes.value) : []);
      } catch {
        setProducts(SEED_PRODUCTS);
        setSales([]);
      }
      setLoaded(true);
    })();
  }, []);

  const saveProducts = useCallback(async (data) => {
    setProducts(data);
    try { await window.storage.set("fm_products", JSON.stringify(data)); } catch {}
  }, []);

  const saveSales = useCallback(async (data) => {
    setSales(data);
    try { await window.storage.set("fm_sales", JSON.stringify(data)); } catch {}
  }, []);

  const todaySales = sales.filter(s => s.date === today());
  const todayRevenue = todaySales.reduce((a,s) => a + s.total, 0);
  const todayProfit = todaySales.reduce((a,s) => a + s.profit, 0);
  const lowStock = products.filter(p => p.quantity <= p.minStock);
  const totalValue = products.reduce((a,p) => a + p.cost * p.quantity, 0);

  const addToCart = (prod) => {
    if (prod.quantity === 0) { showToast("Out of stock!", "error"); return; }
    setCart(c => {
      const ex = c.find(i => i.id === prod.id);
      if (ex) {
        if (ex.qty >= prod.quantity) { showToast("Max stock reached", "error"); return c; }
        return c.map(i => i.id === prod.id ? {...i, qty: i.qty+1} : i);
      }
      return [...c, {id:prod.id, name:prod.name, price:prod.price, cost:prod.cost, qty:1, max:prod.quantity}];
    });
  };

  const removeFromCart = (id) => setCart(c => c.filter(i => i.id !== id));
  const updateCartQty = (id, qty) => {
    const prod = products.find(p => p.id === id);
    if (qty < 1) { removeFromCart(id); return; }
    if (qty > prod.quantity) { showToast("Max stock reached", "error"); return; }
    setCart(c => c.map(i => i.id === id ? {...i, qty} : i));
  };

  const cartTotal = cart.reduce((a,i) => a + i.price * i.qty, 0);
  const cartProfit = cart.reduce((a,i) => a + (i.price - i.cost) * i.qty, 0);
  const change = parseFloat(amountPaid || 0) - cartTotal;

  const completeSale = async () => {
    if (cart.length === 0) return;
    if (payMethod === "Cash" && parseFloat(amountPaid) < cartTotal) {
      showToast("Insufficient payment", "error"); return;
    }
    const sale = {
      id: uid(), date: today(),
      time: new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}),
      items: cart.map(i => ({id:i.id,name:i.name,qty:i.qty,price:i.price})),
      total: cartTotal, profit: cartProfit, paymentMethod: payMethod,
      amountPaid: parseFloat(amountPaid) || cartTotal,
      change: payMethod === "Cash" ? Math.max(0, change) : 0
    };
    const updProds = products.map(p => {
      const ci = cart.find(c => c.id === p.id);
      return ci ? {...p, quantity: p.quantity - ci.qty} : p;
    });
    await saveSales([sale, ...sales]);
    await saveProducts(updProds);
    setCart([]);
    setAmountPaid("");
    setShowCheckout(false);
    setTab("dashboard");
    showToast(`Sale recorded! ${payMethod==="Cash" && change>0 ? "Change: "+GH(Math.max(0,change)) : ""}`);
  };

  const deleteProduct = async (id) => {
    await saveProducts(products.filter(p => p.id !== id));
    setShowProductDetail(null);
    showToast("Product deleted");
  };

  const filteredProducts = products.filter(p => {
    const matchCat = catFilter === "All" || p.category === catFilter;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const filteredSales = saleHistoryDate ? sales.filter(s => s.date === saleHistoryDate) : sales;

  if (!loaded) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",flexDirection:"column",gap:12}}>
      <div style={{width:40,height:40,border:"3px solid var(--color-border-tertiary)",borderTop:"3px solid #1D9E75",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}></div>
      <p style={{color:"var(--color-text-secondary)",fontSize:14}}>Loading Frantreesa Mini Mart...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{fontFamily:"var(--font-sans)",maxWidth:480,margin:"0 auto",minHeight:"100vh",background:"var(--color-background-tertiary)",position:"relative",paddingBottom:80}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fm-btn{background:var(--color-background-primary);border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);padding:8px 14px;font-size:13px;cursor:pointer;color:var(--color-text-primary);transition:background 0.15s}
        .fm-btn:hover{background:var(--color-background-secondary)}
        .fm-btn.primary{background:#1D9E75;border-color:#1D9E75;color:#fff}
        .fm-btn.primary:hover{background:#0F6E56}
        .fm-btn.danger{background:var(--color-background-danger);border-color:var(--color-border-danger);color:var(--color-text-danger)}
        .fm-card{background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:1rem 1.25rem;animation:fadeIn 0.2s ease}
        .fm-input{background:var(--color-background-primary);border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);padding:8px 12px;font-size:14px;color:var(--color-text-primary);width:100%;box-sizing:border-box}
        .fm-input:focus{outline:none;border-color:#1D9E75}
        .stock-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}
      `}</style>

      {toast && (
        <div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:toast.type==="error"?"var(--color-background-danger)":"#1D9E75",color:"#fff",padding:"10px 18px",borderRadius:var_or("var(--border-radius-md)","8px"),fontSize:13,zIndex:9999,whiteSpace:"nowrap",boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
          {toast.msg}
        </div>
      )}

      <div style={{background:"#0F6E56",padding:"16px 16px 12px",position:"sticky",top:0,zIndex:100}}>
        <p style={{margin:0,fontSize:10,color:"#9FE1CB",fontWeight:500,letterSpacing:1,textTransform:"uppercase"}}>Frantreesa</p>
        <h1 style={{margin:0,fontSize:15,color:"#fff",fontWeight:500}}>Mini Mart & Cold Store</h1>
        {lowStock.length > 0 && (
          <div style={{marginTop:8,background:"rgba(255,255,255,0.15)",borderRadius:6,padding:"4px 10px",display:"inline-flex",alignItems:"center",gap:6,cursor:"pointer"}} onClick={()=>{setTab("inventory");setCatFilter("All");}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:"#FAC775",display:"inline-block"}}></span>
            <span style={{fontSize:12,color:"#fff"}}>{lowStock.length} item{lowStock.length>1?"s":""} low on stock</span>
          </div>
        )}
      </div>

      <div style={{padding:"0 12px 12px"}}>

        {tab === "dashboard" && <Dashboard {...{todayRevenue,todayProfit,todaySales,products,lowStock,totalValue,sales,setTab,GH}} />}
        {tab === "pos" && <POS {...{products,cart,addToCart,removeFromCart,updateCartQty,cartTotal,cartProfit,setShowCheckout,search,setSearch,catFilter,setCatFilter,GH,filteredProducts,CATEGORIES}} />}
        {tab === "inventory" && <Inventory {...{filteredProducts,products,search,setSearch,catFilter,setCatFilter,CATEGORIES,setShowAddProduct,setEditProduct,setShowProductDetail,lowStock,GH}} />}
        {tab === "sales" && <SalesHistory {...{filteredSales,saleHistoryDate,setSaleHistoryDate,GH}} />}
        {tab === "reports" && <Reports {...{sales,products,GH,today}} />}

      </div>

      <BottomNav tab={tab} setTab={setTab} cartCount={cart.reduce((a,i)=>a+i.qty,0)} lowStockCount={lowStock.length} />

      {showAddProduct && <ProductForm onClose={()=>setShowAddProduct(false)} onSave={async(p)=>{await saveProducts([...products,{...p,id:uid()}]);setShowAddProduct(false);showToast("Product added!");}} CATEGORIES={CATEGORIES.slice(1)} />}
      {editProduct && <ProductForm initial={editProduct} onClose={()=>setEditProduct(null)} onSave={async(p)=>{await saveProducts(products.map(x=>x.id===p.id?p:x));setEditProduct(null);showToast("Product updated!");}} CATEGORIES={CATEGORIES.slice(1)} />}
      {showCheckout && <Checkout {...{cart,cartTotal,cartProfit,payMethod,setPayMethod,amountPaid,setAmountPaid,change,completeSale,onClose:()=>setShowCheckout(false),GH}} />}
      {showProductDetail && <ProductDetail prod={showProductDetail} onClose={()=>setShowProductDetail(null)} onEdit={()=>{setEditProduct(showProductDetail);setShowProductDetail(null);}} onDelete={()=>deleteProduct(showProductDetail.id)} GH={GH} />}
    </div>
  );
}

function var_or(v,f){return v||f;}

function Dashboard({todayRevenue,todayProfit,todaySales,products,lowStock,totalValue,sales,setTab,GH}){
  const weekSales = sales.slice(0,7);
  const weekRevenue = weekSales.reduce((a,s)=>a+s.total,0);
  return (
    <div style={{paddingTop:12}}>
      <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 10px"}}>Today's Overview</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <StatCard label="Today's Revenue" value={GH(todayRevenue)} accent="#1D9E75" />
        <StatCard label="Today's Profit" value={GH(todayProfit)} accent="#185FA5" />
        <StatCard label="Transactions" value={todaySales.length} accent="#BA7517" />
        <StatCard label="Stock Value" value={GH(totalValue)} accent="#993556" />
      </div>

      {lowStock.length > 0 && (
        <div className="fm-card" style={{marginBottom:14,borderLeft:"3px solid #EF9F27",borderRadius:"0 var(--border-radius-lg) var(--border-radius-lg) 0"}}>
          <p style={{margin:"0 0 8px",fontSize:13,fontWeight:500,color:"var(--color-text-primary)"}}>Low Stock Alerts</p>
          {lowStock.slice(0,4).map(p => (
            <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
              <span style={{fontSize:13,color:"var(--color-text-primary)"}}>{p.name}</span>
              <span style={{fontSize:12,background:"#FAEEDA",color:"#BA7517",padding:"2px 8px",borderRadius:4}}>{p.quantity} left</span>
            </div>
          ))}
          {lowStock.length > 4 && <p style={{fontSize:12,color:"var(--color-text-secondary)",margin:"6px 0 0",cursor:"pointer"}} onClick={()=>setTab("inventory")}>+{lowStock.length-4} more items</p>}
        </div>
      )}

      <div className="fm-card" style={{marginBottom:14}}>
        <p style={{margin:"0 0 10px",fontSize:13,fontWeight:500}}>Quick Actions</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[["New Sale","pos","#1D9E75"],["Inventory","inventory","#185FA5"],["Sales Log","sales","#BA7517"],["Reports","reports","#993556"]].map(([l,t,c])=>(
            <button key={t} className="fm-btn" style={{padding:"12px 8px",textAlign:"center",borderColor:c+"40",color:c}} onClick={()=>setTab(t)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="fm-card">
        <p style={{margin:"0 0 10px",fontSize:13,fontWeight:500}}>Recent Sales</p>
        {sales.slice(0,5).length === 0 ? <p style={{color:"var(--color-text-secondary)",fontSize:13}}>No sales recorded yet.</p> :
          sales.slice(0,5).map(s=>(
            <div key={s.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
              <div>
                <p style={{margin:0,fontSize:13,color:"var(--color-text-primary)"}}>{s.items.length} item{s.items.length>1?"s":""}</p>
                <p style={{margin:0,fontSize:11,color:"var(--color-text-secondary)"}}>{s.date} · {s.time} · {s.paymentMethod}</p>
              </div>
              <p style={{margin:0,fontSize:14,fontWeight:500,color:"#1D9E75"}}>{GH(s.total)}</p>
            </div>
          ))
        }
      </div>
    </div>
  );
}

function StatCard({label,value,accent}){
  return (
    <div style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"12px 14px",borderLeft:`3px solid ${accent}`}}>
      <p style={{margin:"0 0 4px",fontSize:11,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:0.5}}>{label}</p>
      <p style={{margin:0,fontSize:18,fontWeight:500,color:"var(--color-text-primary)"}}>{value}</p>
    </div>
  );
}

function POS({products,cart,addToCart,removeFromCart,updateCartQty,cartTotal,cartProfit,setShowCheckout,search,setSearch,catFilter,setCatFilter,GH,filteredProducts,CATEGORIES}){
  return (
    <div style={{paddingTop:12}}>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <input className="fm-input" style={{flex:1}} placeholder="Search products..." value={search} onChange={e=>setSearch(e.target.value)} />
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:12}}>
        {CATEGORIES.slice(0,8).map(c=>(
          <button key={c} onClick={()=>setCatFilter(c)} style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:`0.5px solid ${catFilter===c?"#1D9E75":"var(--color-border-secondary)"}`,background:catFilter===c?"#1D9E75":"var(--color-background-primary)",color:catFilter===c?"#fff":"var(--color-text-secondary)",fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>{c}</button>
        ))}
      </div>

      {cart.length > 0 && (
        <div className="fm-card" style={{marginBottom:12,borderColor:"#5DCAA5"}}>
          <p style={{margin:"0 0 8px",fontSize:13,fontWeight:500}}>Cart ({cart.reduce((a,i)=>a+i.qty,0)} items)</p>
          {cart.map(item=>(
            <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
              <p style={{flex:1,margin:0,fontSize:13,color:"var(--color-text-primary)"}}>{item.name}</p>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <button onClick={()=>updateCartQty(item.id,item.qty-1)} style={{width:24,height:24,borderRadius:4,border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-secondary)",cursor:"pointer",fontSize:16,lineHeight:1,color:"var(--color-text-primary)"}}>-</button>
                <span style={{fontSize:13,minWidth:20,textAlign:"center"}}>{item.qty}</span>
                <button onClick={()=>updateCartQty(item.id,item.qty+1)} style={{width:24,height:24,borderRadius:4,border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-secondary)",cursor:"pointer",fontSize:16,lineHeight:1,color:"var(--color-text-primary)"}}>+</button>
              </div>
              <p style={{margin:0,fontSize:13,fontWeight:500,minWidth:60,textAlign:"right"}}>{GH(item.price*item.qty)}</p>
              <button onClick={()=>removeFromCart(item.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--color-text-danger)",fontSize:16,padding:0}}>×</button>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
            <p style={{margin:0,fontSize:13,fontWeight:500}}>Total: {GH(cartTotal)}</p>
            <button className="fm-btn primary" onClick={()=>setShowCheckout(true)}>Checkout</button>
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {filteredProducts.map(p=>(
          <div key={p.id} className="fm-card" style={{cursor:"pointer",padding:"10px 12px",opacity:p.quantity===0?0.5:1}} onClick={()=>addToCart(p)}>
            <p style={{margin:"0 0 2px",fontSize:13,fontWeight:500,color:"var(--color-text-primary)",lineHeight:1.3}}>{p.name}</p>
            <p style={{margin:"0 0 6px",fontSize:11,color:"var(--color-text-secondary)"}}>{p.category}</p>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <p style={{margin:0,fontSize:14,fontWeight:500,color:"#1D9E75"}}>{GH(p.price)}</p>
              <span style={{fontSize:11,color:p.quantity<=p.minStock?"#BA7517":"var(--color-text-secondary)"}}>{p.quantity} {p.unit}</span>
            </div>
          </div>
        ))}
      </div>
      {filteredProducts.length === 0 && <p style={{textAlign:"center",color:"var(--color-text-secondary)",fontSize:14,marginTop:40}}>No products found.</p>}
    </div>
  );
}

function Inventory({filteredProducts,products,search,setSearch,catFilter,setCatFilter,CATEGORIES,setShowAddProduct,setEditProduct,setShowProductDetail,lowStock,GH}){
  return (
    <div style={{paddingTop:12}}>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <input className="fm-input" style={{flex:1}} placeholder="Search inventory..." value={search} onChange={e=>setSearch(e.target.value)} />
        <button className="fm-btn primary" onClick={()=>setShowAddProduct(true)} style={{whiteSpace:"nowrap",flexShrink:0}}>+ Add</button>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:12}}>
        {CATEGORIES.slice(0,8).map(c=>(
          <button key={c} onClick={()=>setCatFilter(c)} style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:`0.5px solid ${catFilter===c?"#1D9E75":"var(--color-border-secondary)"}`,background:catFilter===c?"#1D9E75":"var(--color-background-primary)",color:catFilter===c?"#fff":"var(--color-text-secondary)",fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>{c}</button>
        ))}
      </div>
      <p style={{fontSize:12,color:"var(--color-text-secondary)",margin:"0 0 10px"}}>{filteredProducts.length} product{filteredProducts.length!==1?"s":""} · {lowStock.length} low stock</p>
      {filteredProducts.map(p=>(
        <div key={p.id} className="fm-card" style={{marginBottom:8,cursor:"pointer"}} onClick={()=>setShowProductDetail(p)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                <span className="stock-dot" style={{background:p.quantity===0?"#E24B4A":p.quantity<=p.minStock?"#EF9F27":"#1D9E75"}}></span>
                <p style={{margin:0,fontSize:14,fontWeight:500,color:"var(--color-text-primary)"}}>{p.name}</p>
              </div>
              <p style={{margin:0,fontSize:12,color:"var(--color-text-secondary)"}}>{p.category} · {p.unit}</p>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{margin:"0 0 2px",fontSize:14,fontWeight:500,color:"#1D9E75"}}>{GH(p.price)}</p>
              <p style={{margin:0,fontSize:12,color:p.quantity<=p.minStock?"#BA7517":"var(--color-text-secondary)"}}>{p.quantity} in stock</p>
            </div>
          </div>
        </div>
      ))}
      {filteredProducts.length===0 && <p style={{textAlign:"center",color:"var(--color-text-secondary)",fontSize:14,marginTop:40}}>No products found.</p>}
    </div>
  );
}

function SalesHistory({filteredSales,saleHistoryDate,setSaleHistoryDate,GH}){
  const totalRev = filteredSales.reduce((a,s)=>a+s.total,0);
  const totalProfit = filteredSales.reduce((a,s)=>a+s.profit,0);
  return (
    <div style={{paddingTop:12}}>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <input type="date" className="fm-input" value={saleHistoryDate} onChange={e=>setSaleHistoryDate(e.target.value)} style={{flex:1}} />
        {saleHistoryDate && <button className="fm-btn" onClick={()=>setSaleHistoryDate("")}>Clear</button>}
      </div>
      {filteredSales.length > 0 && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <StatCard label="Revenue" value={GH(totalRev)} accent="#1D9E75" />
          <StatCard label="Profit" value={GH(totalProfit)} accent="#185FA5" />
        </div>
      )}
      {filteredSales.length===0 ? <p style={{textAlign:"center",color:"var(--color-text-secondary)",fontSize:14,marginTop:40}}>No sales found.</p> :
        filteredSales.map(s=>(
          <div key={s.id} className="fm-card" style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <div>
                <p style={{margin:"0 0 2px",fontSize:14,fontWeight:500}}>{s.date} · {s.time}</p>
                <p style={{margin:0,fontSize:12,color:"var(--color-text-secondary)"}}>{s.paymentMethod} · {s.items.length} item{s.items.length>1?"s":""}</p>
              </div>
              <div style={{textAlign:"right"}}>
                <p style={{margin:"0 0 2px",fontSize:14,fontWeight:500,color:"#1D9E75"}}>{GH(s.total)}</p>
                <p style={{margin:0,fontSize:12,color:"var(--color-text-secondary)"}}>Profit: {GH(s.profit)}</p>
              </div>
            </div>
            {s.items.map((it,i)=>(
              <p key={i} style={{margin:"2px 0",fontSize:12,color:"var(--color-text-secondary)"}}>{it.qty}x {it.name} — {GH(it.price*it.qty)}</p>
            ))}
          </div>
        ))
      }
    </div>
  );
}

function Reports({sales,products,GH}){
  const catRevenue = {};
  sales.forEach(s=>s.items.forEach(it=>{
    const prod = products.find(p=>p.id===it.id);
    const cat = prod?.category||"Other";
    catRevenue[cat]=(catRevenue[cat]||0)+it.price*it.qty;
  }));
  const catArr = Object.entries(catRevenue).sort((a,b)=>b[1]-a[1]);
  const maxCat = catArr[0]?.[1]||1;
  const totalRev = sales.reduce((a,s)=>a+s.total,0);
  const totalProfit = sales.reduce((a,s)=>a+s.profit,0);
  const margin = totalRev>0?((totalProfit/totalRev)*100).toFixed(1):0;

  const topProducts = {};
  sales.forEach(s=>s.items.forEach(it=>{topProducts[it.name]=(topProducts[it.name]||0)+it.qty;}));
  const topArr = Object.entries(topProducts).sort((a,b)=>b[1]-a[1]).slice(0,5);

  return (
    <div style={{paddingTop:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <StatCard label="Total Revenue" value={GH(totalRev)} accent="#1D9E75" />
        <StatCard label="Total Profit" value={GH(totalProfit)} accent="#185FA5" />
        <StatCard label="Profit Margin" value={margin+"%"} accent="#BA7517" />
        <StatCard label="Total Sales" value={sales.length} accent="#993556" />
      </div>

      <div className="fm-card" style={{marginBottom:14}}>
        <p style={{margin:"0 0 12px",fontSize:13,fontWeight:500}}>Revenue by category</p>
        {catArr.length===0 ? <p style={{color:"var(--color-text-secondary)",fontSize:13}}>No data yet.</p> :
          catArr.map(([cat,rev])=>(
            <div key={cat} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span style={{fontSize:12,color:"var(--color-text-primary)"}}>{cat}</span>
                <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{GH(rev)}</span>
              </div>
              <div style={{height:6,background:"var(--color-background-secondary)",borderRadius:3}}>
                <div style={{height:6,background:"#1D9E75",borderRadius:3,width:`${(rev/maxCat)*100}%`,transition:"width 0.4s"}}></div>
              </div>
            </div>
          ))
        }
      </div>

      <div className="fm-card">
        <p style={{margin:"0 0 10px",fontSize:13,fontWeight:500}}>Top selling products</p>
        {topArr.length===0 ? <p style={{color:"var(--color-text-secondary)",fontSize:13}}>No data yet.</p> :
          topArr.map(([name,qty],i)=>(
            <div key={name} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{width:20,height:20,borderRadius:"50%",background:"#E1F5EE",color:"#0F6E56",fontSize:11,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</span>
                <span style={{fontSize:13}}>{name}</span>
              </div>
              <span style={{fontSize:12,color:"var(--color-text-secondary)"}}>{qty} sold</span>
            </div>
          ))
        }
      </div>
    </div>
  );
}

function ProductForm({initial,onClose,onSave,CATEGORIES}){
  const [form,setForm]=useState(initial||{name:"",category:CATEGORIES[0],price:"",cost:"",quantity:"",minStock:"",unit:"piece"});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const valid = form.name && form.price && form.cost && form.quantity && form.minStock;
  return (
    <Modal title={initial?"Edit Product":"Add Product"} onClose={onClose}>
      <div style={{display:"grid",gap:10}}>
        <div><label style={{fontSize:12,color:"var(--color-text-secondary)"}}>Product name</label><input className="fm-input" style={{marginTop:4}} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Coca-Cola 500ml" /></div>
        <div><label style={{fontSize:12,color:"var(--color-text-secondary)"}}>Category</label>
          <select className="fm-input" style={{marginTop:4}} value={form.category} onChange={e=>set("category",e.target.value)}>
            {CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div><label style={{fontSize:12,color:"var(--color-text-secondary)"}}>Selling price (GH₵)</label><input className="fm-input" style={{marginTop:4}} type="number" value={form.price} onChange={e=>set("price",e.target.value)} placeholder="0.00" /></div>
          <div><label style={{fontSize:12,color:"var(--color-text-secondary)"}}>Cost price (GH₵)</label><input className="fm-input" style={{marginTop:4}} type="number" value={form.cost} onChange={e=>set("cost",e.target.value)} placeholder="0.00" /></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div><label style={{fontSize:12,color:"var(--color-text-secondary)"}}>Quantity in stock</label><input className="fm-input" style={{marginTop:4}} type="number" value={form.quantity} onChange={e=>set("quantity",e.target.value)} /></div>
          <div><label style={{fontSize:12,color:"var(--color-text-secondary)"}}>Low stock alert at</label><input className="fm-input" style={{marginTop:4}} type="number" value={form.minStock} onChange={e=>set("minStock",e.target.value)} /></div>
        </div>
        <div><label style={{fontSize:12,color:"var(--color-text-secondary)"}}>Unit</label><input className="fm-input" style={{marginTop:4}} value={form.unit} onChange={e=>set("unit",e.target.value)} placeholder="piece, bottle, kg..." /></div>
        <button className="fm-btn primary" disabled={!valid} style={{marginTop:4,padding:"10px"}} onClick={()=>onSave({...form,price:parseFloat(form.price),cost:parseFloat(form.cost),quantity:parseInt(form.quantity),minStock:parseInt(form.minStock)})}>
          {initial?"Save Changes":"Add Product"}
        </button>
      </div>
    </Modal>
  );
}

function Checkout({cart,cartTotal,cartProfit,payMethod,setPayMethod,amountPaid,setAmountPaid,change,completeSale,onClose,GH}){
  return (
    <Modal title="Checkout" onClose={onClose}>
      <div style={{maxHeight:"60vh",overflowY:"auto",marginBottom:12}}>
        {cart.map(i=>(
          <div key={i.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
            <span style={{fontSize:13}}>{i.qty}x {i.name}</span>
            <span style={{fontSize:13,fontWeight:500}}>{GH(i.price*i.qty)}</span>
          </div>
        ))}
      </div>
      <div style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"10px 12px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13}}>Subtotal</span><span style={{fontSize:13,fontWeight:500}}>{GH(cartTotal)}</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"var(--color-text-secondary)"}}>Est. Profit</span><span style={{fontSize:12,color:"#1D9E75"}}>{GH(cartProfit)}</span></div>
      </div>
      <div style={{marginBottom:12}}>
        <label style={{fontSize:12,color:"var(--color-text-secondary)"}}>Payment method</label>
        <div style={{display:"flex",gap:8,marginTop:6}}>
          {["Cash","MoMo","Card"].map(m=>(
            <button key={m} onClick={()=>setPayMethod(m)} style={{flex:1,padding:"8px",borderRadius:"var(--border-radius-md)",border:`0.5px solid ${payMethod===m?"#1D9E75":"var(--color-border-secondary)"}`,background:payMethod===m?"#E1F5EE":"var(--color-background-primary)",color:payMethod===m?"#0F6E56":"var(--color-text-primary)",cursor:"pointer",fontSize:13}}>{m}</button>
          ))}
        </div>
      </div>
      {payMethod==="Cash" && (
        <div style={{marginBottom:12}}>
          <label style={{fontSize:12,color:"var(--color-text-secondary)"}}>Amount tendered</label>
          <input className="fm-input" style={{marginTop:4}} type="number" value={amountPaid} onChange={e=>setAmountPaid(e.target.value)} placeholder={cartTotal.toFixed(2)} />
          {amountPaid && parseFloat(amountPaid) >= cartTotal && <p style={{margin:"6px 0 0",fontSize:13,color:"#1D9E75",fontWeight:500}}>Change: {GH(Math.max(0,change))}</p>}
          {amountPaid && parseFloat(amountPaid) < cartTotal && <p style={{margin:"6px 0 0",fontSize:13,color:"var(--color-text-danger)"}}>Insufficient payment</p>}
        </div>
      )}
      <button className="fm-btn primary" style={{width:"100%",padding:"12px"}} onClick={completeSale}>
        Complete Sale — {GH(cartTotal)}
      </button>
    </Modal>
  );
}

function ProductDetail({prod,onClose,onEdit,onDelete,GH}){
  const margin = prod.price>0?(((prod.price-prod.cost)/prod.price)*100).toFixed(1):0;
  return (
    <Modal title="Product Details" onClose={onClose}>
      <div style={{display:"grid",gap:10}}>
        <p style={{margin:0,fontSize:16,fontWeight:500}}>{prod.name}</p>
        <p style={{margin:"0",fontSize:13,color:"var(--color-text-secondary)"}}>{prod.category} · {prod.unit}</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <InfoRow label="Selling Price" value={GH(prod.price)} />
          <InfoRow label="Cost Price" value={GH(prod.cost)} />
          <InfoRow label="Qty in Stock" value={prod.quantity} color={prod.quantity<=prod.minStock?"#BA7517":undefined} />
          <InfoRow label="Low Stock At" value={prod.minStock} />
          <InfoRow label="Profit Margin" value={margin+"%"} color="#1D9E75" />
          <InfoRow label="Stock Value" value={GH(prod.cost*prod.quantity)} />
        </div>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <button className="fm-btn" style={{flex:1}} onClick={onEdit}>Edit</button>
          <button className="fm-btn danger" style={{flex:1}} onClick={()=>{if(confirm("Delete this product?"))onDelete();}}>Delete</button>
        </div>
      </div>
    </Modal>
  );
}

function InfoRow({label,value,color}){
  return (
    <div style={{background:"var(--color-background-secondary)",padding:"8px 10px",borderRadius:"var(--border-radius-md)"}}>
      <p style={{margin:"0 0 2px",fontSize:11,color:"var(--color-text-secondary)"}}>{label}</p>
      <p style={{margin:0,fontSize:14,fontWeight:500,color:color||"var(--color-text-primary)"}}>{value}</p>
    </div>
  );
}

function Modal({title,onClose,children}){
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"var(--color-background-primary)",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",padding:"20px 16px 32px",animation:"fadeIn 0.2s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <p style={{margin:0,fontSize:15,fontWeight:500}}>{title}</p>
          <button onClick={onClose} style={{background:"var(--color-background-secondary)",border:"none",borderRadius:"50%",width:28,height:28,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--color-text-primary)"}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BottomNav({tab,setTab,cartCount,lowStockCount}){
  const items=[
    {id:"dashboard",icon:"grid",label:"Dashboard"},
    {id:"pos",icon:"cart",label:"Sell",badge:cartCount},
    {id:"inventory",icon:"box",label:"Stock",badge:lowStockCount,badgeColor:"#EF9F27"},
    {id:"sales",icon:"list",label:"Sales"},
    {id:"reports",icon:"chart",label:"Reports"},
  ];
  return (
    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"var(--color-background-primary)",borderTop:"0.5px solid var(--color-border-tertiary)",display:"flex",zIndex:150,paddingBottom:"env(safe-area-inset-bottom,0)"}}>
      {items.map(it=>(
        <button key={it.id} onClick={()=>setTab(it.id)} style={{flex:1,padding:"8px 0 6px",border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,position:"relative"}}>
          <NavIcon type={it.icon} active={tab===it.id} />
          {it.badge > 0 && <span style={{position:"absolute",top:4,right:"calc(50% - 14px)",background:it.badgeColor||"#E24B4A",color:"#fff",fontSize:9,borderRadius:10,minWidth:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:500,padding:"0 3px"}}>{it.badge}</span>}
          <span style={{fontSize:10,color:tab===it.id?"#1D9E75":"var(--color-text-secondary)",fontWeight:tab===it.id?500:400}}>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

function NavIcon({type,active}){
  const c = active?"#1D9E75":"var(--color-text-secondary)";
  const icons={
    grid:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
    cart:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
    box:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    list:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
    chart:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  };
  return icons[type]||null;
}
