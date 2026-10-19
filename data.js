// AKS Seafood — click-through walkthrough: all the content lives here, the page (index.html) only draws it.
// Edit this file to rename a step, change what a role's dashboard says, or point a moment at another image.
// Images are looked up as screens/<img>.png, then screens/<img>.jpg. Missing images show a placeholder naming the file.
//
// Who sees which picture:
//   * `img` / `views`     PHONE pictures for the people who act at a moment (`views` = a different one for a named role).
//   * `web` / `webViews`  WEBSITE (laptop) pictures, only for the Admin, on the screens the Admin acts on.
//   * `adminImg` / `adminWeb`  the Admin's OWN phone and website screens for a moment that someone else acts on (a list of what
//                         that team recorded, with Edit where it makes sense). Every moment the Admin does not act in has them.
// Every other role, including the Purchase Manager for now, has a phone picture only.
// Names are PLACEHOLDERS (real employee names have not been shared). All figures are SAMPLE DATA.

window.AKS = {
  brand: 'AKS Seafood',

  // The Admin (the owner) can do everything the other users do; small businesses have owners who step in.
  adminDoesAll: true,

  // One entry per kind of user. `bg` tints the whole page when that user is selected ("the background changes by user").
  roles: [
    { id: 'admin', label: 'Admin', name: 'Mori', color: '#1F2F54', bg: '#E8EDF7', web: true },
    { id: 'purchase_mgr', label: 'Purchase Manager', name: 'Karthik', color: '#0E7C7B', bg: '#E4F3F2' },
    { id: 'purchase_team', label: 'Purchase team (also loads at the point)', name: 'Selvam', color: '#2A6FBA', bg: '#E6EFFA' },
    { id: 'receiving', label: 'Receiving & grading', name: 'Anbu', color: '#2F8F5B', bg: '#E5F4EB' },
    { id: 'sales', label: 'Sales team', name: 'Priya', color: '#7A4FB0', bg: '#F0EAF8' },
    { id: 'packing', label: 'Packing & loading team', name: 'Raja', color: '#B4533C', bg: '#F8E9E5' },
    { id: 'accounts', label: 'Accounts', name: 'Lakshmi', color: '#4C6A85', bg: '#E9EEF3' }
  ],

  // The junctions on the progress bar. A step's first moment sits on the junction; its other moments are the small dots after it.
  steps: [
    { id: 'pre', title: 'Pre-purchase' },
    { id: 'buy', title: 'Purchase at the point' },
    { id: 'load', title: 'Loading at the point' },
    { id: 'recv', title: 'Receiving' },
    { id: 'grade', title: 'Grading and storing' },
    { id: 'po', title: 'Purchase order check' },
    { id: 'sales', title: 'Sales' },
    { id: 'pack', title: 'Packing' },
    { id: 'send', title: 'Dispatch' },
    { id: 'close', title: 'Closing the purchase' },
    { id: 'pay', title: 'Payments' },
    { id: 'cost', title: 'Costs and profit' }
  ],

  // What a user who has nothing to do in a step is told. Anything missing falls back to "Nothing for you in this step."
  context: {
    pre: { admin: 'It is Navratri: demand and prices are low, so the forecast is lower. Review it, then see what to buy tomorrow.',
             purchase_mgr: 'You check tomorrow’s draft PO and share it with the purchase team.',
             purchase_team: 'You will see the total to buy today and the price to negotiate for each fish.',
             sales: 'You can already see what is likely to come. Photos arrive with the purchases.' },
    buy: { admin: 'The purchase team is buying and recording each vendor. Someone is sent for ice, packing material and crates.',
             purchase_mgr: 'Watch the draft PO fill up, and decide who is sent to buy ice, packing material and crates.',
             purchase_team: 'You buy at the point and record each vendor: fish, kilos, whether it was sorted by size, and the price asked. If you are sent on an errand, you buy and upload the bill.',
             sales: 'Photos are coming in: call customers and take orders now.',
             accounts: 'If a price is confirmed against an order, an upfront payment may be needed.' },
    load: { admin: 'The truck is being loaded at the point.',
             purchase_mgr: 'The truck is being loaded.',
             purchase_team: 'You weigh each fish in total, fill the crates to 25.00 kg or more, weigh the mixed crate, record it all and photograph the vehicle leaving.',
             receiving: 'A truck is being loaded. You will be told when it has left.',
             sales: 'Stock is about to arrive.' },
    recv: { admin: 'The truck has arrived. Nothing to decide yet.',
             purchase_mgr: 'The truck has arrived.',
             purchase_team: 'Nothing unless a shortage needs a call to the vendor.',
             receiving: 'You photograph the vehicle unloaded, count the crates and weigh the mixed crates.',
             sales: 'The truck has arrived. Stock appears after grading.' },
    grade: { admin: 'A difference of more than 5 kg from what the vendor said is shown to you. Profit by size appears as grading finishes.',
             purchase_mgr: 'Differences of more than 5 kg from what the vendor said are shown here too.',
             receiving: 'You grade, weigh, photograph and store the fish, and send the empty crates back.',
             sales: 'Stock appears here as each size is graded.' },
    po: { admin: 'Check the four weights: what the vendor said, the loading scale, the unloaded crates, the grading.',
             purchase_mgr: 'Check the four weights. The price is still not final.',
             sales: 'You can now sell what is in stock.' },
    sales: { admin: 'Orders are being confirmed. Watch profit by size.',
             purchase_mgr: 'Today’s orders show what to buy tomorrow.',
             sales: 'You take orders, choose the way to send and set the times.',
             accounts: 'Orders on credit create what customers owe.',
             packing: 'A packing job arrives when sales sends it.' },
    pack: { admin: 'Packing is in progress.',
             sales: 'Watch the packing. You can hold or send.',
             packing: 'Pack as soon as the job arrives: there is no cold storage.' },
    send: { admin: 'Dispatch is in progress.',
             sales: 'Watch the leave times.',
             packing: 'You load the goods onto the transporter’s vehicle, or take them to the railway station, in the right order.' },
    close: { admin: 'You decide the final price per kg for each vendor, never above what he asked. You are reminded on day 1, 1.5 and 2, and when the fish has sold out or the target is hit.',
             purchase_mgr: 'You decide the final price per kg for each vendor, never above what he asked.',
             sales: 'The prices you sold at are shown to the person deciding.',
             accounts: 'The money expected from customers is shown to the person deciding.' },
    pay: { admin: 'You see what is owed and who pays on time.',
             sales: 'You see who pays on time and how much they owe.',
             accounts: 'You record payments.' },
    cost: { admin: 'You enter the costs and salary and read the dashboard.',
             accounts: 'Billing and accounting are a later session.' }
  },

  // The workflow, in order. `who` = users who act; `lead` = whose turn it is when the page follows the workflow;
  // `asks` = what to ask the owner on this screen.
  moments: [
    { id: 'm01', step: 'pre', title: 'The forecast: what to buy', who: ['admin', 'purchase_mgr'], lead: 'admin', web: 'm01-forecast-web', img: 'm01-forecast',
      story: 'It is Navratri, so demand is low and prices are low: the forecast is lower than the last 3 days. The app suggests how much of each fish to buy and what price to negotiate, using the Tamil, South-India, Muslim and Christian calendars and past sales. The Admin (or the Purchase Manager) uses their judgment.',
      asks: ['Q3 What else should the forecast show?', 'Q5 Suggest only, or also make the draft PO?', 'Q4 Which festivals and markets?'] },

    { id: 'm02', step: 'pre', title: 'What vendors plan to catch', who: ['purchase_mgr', 'purchase_team'], adminImg: 'm02-catch-plans', adminWeb: 'm02-catch-plans-web', img: 'm02-catch-plans',
      story: 'Vendors are asked what they plan to catch. Their answers go into the forecast.',
      asks: ['Q7 How do vendors tell you — call, WhatsApp, in person?'] },

    { id: 'm03', step: 'pre', title: 'Tomorrow’s draft PO', who: ['purchase_mgr', 'admin'], lead: 'purchase_mgr', web: 'm03-draft-po-web', img: 'm03-draft-po',
      story: 'The app makes tomorrow’s draft PO by itself from the forecast and what the vendors plan to catch. The Purchase Manager (or the Admin) checks it, can change it, and shares it with the purchase team.',
      asks: ['Q8 Does the draft PO need approval before it is shared?', 'Q5 Should it ever be shared without a person checking?'] },

    { id: 'm04', step: 'pre', title: 'The purchase team gets the draft PO', who: ['purchase_team'], adminImg: 'm03-draft-po', adminWeb: 'm03-draft-po-web', img: 'm04-draft-po-phone',
      story: 'The purchase team sees only the total to buy today and the price to negotiate for each fish. (Later, with enough data, the price can also be suggested for each fish at each point.)',
      asks: ['Is the total and the negotiating price all they should see?'] },

    { id: 'm05', step: 'buy', title: 'Buying at the point, vendor by vendor', who: ['purchase_team'], adminImg: 'a05-purchases', adminWeb: 'a05-purchases-web', img: 'm05-buy',
      story: 'At the point the purchase team records each vendor: the fish, the kilos, whether it was already sorted by size there, and the price the vendor asked per kg. Nothing is final yet.',
      asks: ['Q10 Record the boat?', 'If it was bought by size, are the size and kilos typed here?', 'What else about a purchase must be recorded?'] },

    { id: 'm06', step: 'buy', title: 'Photos, and the draft PO fills', who: ['purchase_team'], views: { sales: 'm06s-sales-draft' }, adminImg: 'a05-purchases', adminWeb: 'a05-purchases-web', img: 'm06-photos',
      story: 'The purchase team uploads photos of the fish. The sales team sees the same draft PO with the photos and starts calling customers.',
      asks: ['Q9 Who takes the photos, and is one required before a line counts?'] },

    { id: 'm43', step: 'buy', title: 'Sending someone to buy ice, packing material and crates', who: ['purchase_mgr', 'admin'], lead: 'purchase_mgr', web: 'm43-errand-assign-web', img: 'm43-errand-assign',
      story: 'Ice, packing material and crates are miscellaneous charges. The Purchase Manager or the Admin decides who is sent to buy them: it can be anyone on any team, even in turns. The person is given the errand.',
      asks: ['Who decides, and is it ever done in turns?', 'What else is bought this way?'] },

    { id: 'm44', step: 'buy', title: 'The errand', who: ['purchase_team'], adminImg: 'a44-errands', adminWeb: 'm43-errand-assign-web', img: 'm44-errand-mine',
      story: 'The person who was sent types what they spent and uploads a photo of the bill. It goes straight into the costs.',
      asks: ['Is a photo of the bill enough, or must a receipt number be typed?'] },

    { id: 'm08', step: 'load', title: 'Weighing the fish', who: ['purchase_team'], adminImg: 'a08-loading', adminWeb: 'a08-loading-web', img: 'm08-total-weight',
      story: 'At the point the purchase team weighs all the fish of each kind together (all vendors together) and records that one total. If they manage to weigh each vendor on his own, they can enter that too (see the optional screen), so one vendor’s mistake does not cost the others.',
      asks: ['Is the scale weighing done once per point, all vendors together?'] },

    { id: 'm45', step: 'load', title: 'Optional: weighing each vendor on his own', who: ['purchase_team'], adminImg: 'a08-loading', adminWeb: 'a08-loading-web', img: 'm45-weigh-by-vendor',
      story: 'This is not the normal way. If the purchase team manages to weigh a fish vendor by vendor at the point, they enter each weight. A vendor who was weighed on his own is paid for that weight, so the others are not charged for his mistake; vendors who were not weighed share what is left in proportion to what they said.',
      asks: ['How often could the purchase team weigh each vendor?', 'If only some vendors are weighed, do the rest share what is left?'] },

    { id: 'm09', step: 'load', title: 'Filling the crates', who: ['purchase_team'], adminImg: 'a08-loading', adminWeb: 'a08-loading-web', img: 'm09-crates',
      story: 'They fill the crates of each fish: each at least 25.00 kg and no more than 25.15 kg. They tap +1, +3, +5 or type how many crates they filled. If they want, they can enter the actual kilos per crate and how many crates of that weight, which removes the guesswork.',
      asks: ['Q18b Are +1 / +3 / +5 or a typed total quick enough?', 'Is entering the real crate weights worth offering?'] },

    { id: 'm37', step: 'load', title: 'The mixed crate', who: ['purchase_team'], adminImg: 'a08-loading', adminWeb: 'a08-loading-web', img: 'm37-mixed-crate',
      story: 'The app suggests how much of each fish goes into the mixed crate (total minus 25 kg times the crates). They weigh what actually goes in and record it for each fish. If it is less than suggested, the difference is added to "other weights" in the profit and loss.',
      asks: ['Is this the right way round: weighed less than suggested means other weights?', 'Q16 How many kinds of fish can go in one mixed crate?'] },

    { id: 'm10', step: 'load', title: 'Truck left', who: ['purchase_team'], adminImg: 'a08-loading', adminWeb: 'a08-loading-web', img: 'm10-truck-summary',
      story: 'When the weighing, crating and recording for the point are done, the purchase team uploads a photo of the vehicle leaving and checks off "Truck left". The app stamps the time and shares it with everyone who needs it. Nothing about the vehicle is typed.',
      asks: ['Is one photo of the vehicle leaving enough?'] },

    { id: 'm11', step: 'load', title: 'Everyone is told', who: ['sales', 'admin', 'receiving'], views: { sales: 'm11-told-sales', admin: 'm11-told-admin', receiving: 'm11-told-receiving' }, webViews: { admin: 'm11-told-admin-web' }, img: 'm11-told-sales',
      story: 'Everyone who needs it is told that the truck has left, and when, with the breakdown: sales sees the stock coming, the Admin sees what the vendors said against what was loaded, and receiving sees the crates to expect. Change the user to see each view.',
      asks: ['Q17 How is each team told?', 'Q17 Who must not see the cost?'] },

    { id: 'm12', step: 'recv', title: 'The truck arrives', who: ['receiving'], adminImg: 'a12-receiving', adminWeb: 'a12-receiving-web', img: 'm12-arrived',
      story: 'The receiving team opens the truck that was announced and uploads a photo of the vehicle unloaded. The app stamps the arrival time.',
      asks: ['Is the photo taken when the truck arrives, or after it is unloaded?'] },

    { id: 'm13', step: 'recv', title: 'Counting the crates', who: ['receiving'], adminImg: 'a12-receiving', adminWeb: 'a12-receiving-web', img: 'm13-count',
      story: 'They check that the right number of crates of each fish has arrived. Full crates are not weighed again; now and then someone may weigh one as a spot check.',
      asks: ['Q19 Is counting enough?'] },

    { id: 'm14', step: 'recv', title: 'Opening the mixed crates', who: ['receiving'], adminImg: 'a12-receiving', adminWeb: 'a12-receiving-web', img: 'm14-weigh-mixed',
      story: 'They open the mixed crates, weigh each fish’s part and type it in. The app shows crates times 25 kg plus the mixed-crate weight for each fish, and the team ticks it off.',
      asks: ['Q19 Who else checks it?'] },

    { id: 'm15', step: 'grade', title: 'Grading again, with photos', who: ['receiving'], adminImg: 'a15-grading', adminWeb: 'a15-grading-web', img: 'm15-grade',
      story: 'The fish is taken out of the crates and weighed a second time by size, photographed, and damaged fish is recorded. This second weighing corrects the inventory weights.',
      asks: ['Q21 The sizes for each fish and whether they cover every weight', 'Q22 One photo of each size per truck?', 'The damage categories for each fish: please send the list'] },

    { id: 'm38', step: 'grade', title: 'More than 5 kg from what the vendor said', who: ['admin', 'purchase_mgr'], lead: 'admin', web: 'm38-alert-5kg-web', img: 'm38-alert-5kg',
      story: 'Each measured weight (loading, unloaded, graded) is compared with the weight the vendor said. If one is more than 5 kg away, more or less (damage included), the Admin is told. Vendors often have no scales or weigh by eye, so differences are likely. Nobody is hired to cross-check and there is no scale device: the app only shows the warning.',
      asks: ['Is the limit 5 kg for each fish at each point, all vendors together?'] },

    { id: 'm39', step: 'grade', title: 'Stored in ice; empty crates go back', who: ['receiving'], adminImg: 'a15-grading', adminWeb: 'a15-grading-web', img: 'm39-store-return',
      story: 'Graded fish is stored in ice in separate inventory crates, kept apart by fish and size. The empty crates go back on the truck, which goes back to the point or on to another point.',
      asks: ['Do the inventory crates need numbers, or only totals by fish and size?'] },

    { id: 'm16', step: 'grade', title: 'Stock: the total', who: ['sales', 'admin'], web: 'm16-stock-total-web', img: 'm16-stock-total',
      story: 'The stock first shows one total per fish. Click a row to open it.',
      asks: ['Is total → points → sizes the right order to open it?'] },

    { id: 'm17', step: 'grade', title: 'Stock: by point', who: ['sales', 'admin'], web: 'm17-stock-points-web', img: 'm17-stock-points',
      story: 'Opening a fish shows each point it came from.',
      asks: [] },

    { id: 'm18', step: 'grade', title: 'Stock: by size', who: ['sales', 'admin'], web: 'm18-stock-sizes-web', img: 'm18-stock-sizes',
      story: 'Opening the fish again shows its size categories.',
      asks: [] },

    { id: 'm19', step: 'grade', title: 'Profit by size', who: ['admin'], web: 'm19-profit-web', img: 'm19-profit',
      story: 'The Admin is told the profit for each size: the forecast price, minus the cost, minus the charges per kg (transport, operation, packaging and other charges, averaged over the buyers of the cheapest size). Fish lost after loading (extra in the crates, damage) is taken off as "other weights". It is confirmed later by the sale and the payment.',
      asks: ['Q24 Where does the forecast price for each size come from?', 'The loss categories for each fish (damage, extra weight, others): please send the list'] },

    { id: 'm40', step: 'po', title: 'Purchase order: the weights', who: ['purchase_mgr', 'admin'], lead: 'purchase_mgr', web: 'm40-po-weights-web', img: 'm40-po-weights',
      story: 'Four weights are shown side by side: what the vendor said, the loading scale, the unloaded crates and the grading. Vendors are paid for the loading-scale weight, shared among them in proportion to what each said; a vendor who was weighed on his own is paid for that weight instead, so the others are not charged for his mistake. The difference is not reported to the vendors and lowers the purchase cost. What is lost after loading goes to "other weights". The price per kg is still not final.',
      asks: ['If the scale shows more than the vendors said, do we pay only what they said?'] },

    { id: 'm20', step: 'sales', title: 'Customers and credit', who: ['sales'], adminImg: 'a21-orders', adminWeb: 'a21-orders-web', img: 'm20-customers',
      story: 'The sales team keeps the customer list. Customers buy on credit and usually pay in 7 to 15 days.',
      asks: ['Q26 Who is on the sales team?', 'Q34 Credit limit, reminders, late fees?'] },

    { id: 'm21', step: 'sales', title: 'The sales order', who: ['sales'], adminImg: 'a21-orders', adminWeb: 'a21-orders-web', img: 'm21-order',
      story: 'The order has six things: SKU category, weight, price per kg, delivery time, quality and delivery location.',
      asks: ['Q26 What are the choices for "quality"?', 'Q27 Can an order change after packing starts?', 'Q28 Who makes the bill, and when?'] },

    { id: 'm22', step: 'sales', title: 'Choosing how to send it', who: ['sales'], adminImg: 'a21-orders', adminWeb: 'a21-orders-web', img: 'm22-transport',
      story: 'Sales looks up the train, bus or truck in the timetable and booking apps they use, then types when the goods must reach the station, when they must leave the warehouse and the packing deadline. These go on the order.',
      asks: ['Q29 Is the transport table right?', 'Q30 Anything else the packing team needs?'] },

    { id: 'm23', step: 'sales', title: 'Routes: hold or send', who: ['sales'], adminImg: 'a23-routes', adminWeb: 'a23-routes-web', img: 'm23-hold-send',
      story: 'Sales groups the orders that go the same way. When the orders on one bus or truck route add up to more than 800 kg, a truck has to be booked. Sales may hold the job or send it to packing at once.',
      asks: ['Q31 What is normal, and how long may sales hold?', 'Q32 Does packing see customer names?', 'Where are routes and trucks found — a bus app, a truck app?'] },

    { id: 'm24', step: 'pack', title: 'The packing job', who: ['packing'], adminImg: 'a24-packing', adminWeb: 'a24-packing-web', img: 'm24-job',
      story: 'The packing and dispatch team sees only what it needs: the fish and weight, the packing material, the way to send and the time the goods must leave the warehouse.',
      asks: ['Q30 Is that everything they need?'] },

    { id: 'm25', step: 'pack', title: 'Filling the box', who: ['packing'], adminImg: 'a24-packing', adminWeb: 'a24-packing-web', img: 'm25-box',
      story: 'They pack at once because there is no cold storage.',
      asks: ['Q35 Who records the ice and packing material?'] },

    { id: 'm26', step: 'pack', title: 'The label', who: ['packing'], adminImg: 'a24-packing', adminWeb: 'a24-packing-web', img: 'm26-label',
      story: 'The label is plain text: box number, customer code, way to send and leave-by time. No QR code.',
      asks: ['Is a handwritten or printed label enough for now?'] },

    { id: 'm27', step: 'send', title: 'The send board', who: ['packing'], adminImg: 'a27-dispatch', adminWeb: 'a27-dispatch-web', img: 'm27-board',
      story: 'The team sees what leaves when, by train, bus or truck, with the transporter’s number. There is no private bus or truck on Saturday.',
      asks: ['Q29 Self truck: only around Rameshwaram? Private truck usual time?'] },

    { id: 'm28', step: 'send', title: 'Loading in the right order', who: ['packing'], adminImg: 'a27-dispatch', adminWeb: 'a27-dispatch-web', img: 'm28-load-order',
      story: 'When several customers share one truck or bus, the last stop is loaded first and the first stop last, by the door. The same applies to the local truck.',
      asks: ['Q41 Is this the right way round?'] },

    { id: 'm29', step: 'send', title: 'Over 800 kg: book a private truck', who: ['packing'], adminImg: 'a27-dispatch', adminWeb: 'a27-dispatch-web', img: 'm29-private-truck',
      story: 'The customers on one route add up to more than 800 kg, so a private truck must be booked. It leaves at 3 pm, so packing must be finished by 2 pm. The packing team, who have the transporter details, book it and load it in the right order.',
      asks: ['Q29 Which apps or contacts do you use to find a truck?'] },

    { id: 'm30', step: 'send', title: 'Handed over', who: ['packing'], adminImg: 'a27-dispatch', adminWeb: 'a27-dispatch-web', img: 'm30-handover',
      story: 'The parcel is handed to the train, bus or truck and the sales team is told.',
      asks: [] },

    { id: 'm41', step: 'close', title: 'Time to decide the price', who: ['purchase_mgr', 'admin'], lead: 'purchase_mgr', web: 'm41-decide-notice-web', img: 'm41-decide-notice',
      story: 'The person who decides is reminded on day 1, day 1.5 and day 2 after the purchase, and as soon as that fish type has sold out (zero or very low stock) or the target set yesterday from the forecast has been hit. The reminder shows whether the fish sold, at what price, to whom, when the money is expected and the charges. There is no fixed deadline: the owner decides.',
      asks: ['What counts as "very low stock": 10% of what arrived?', 'Reminders at day 1, 1.5 and 2: fixed, or changeable by the owner?'] },

    { id: 'm42', step: 'close', title: 'What we can pay each vendor', who: ['purchase_mgr', 'admin'], lead: 'purchase_mgr', web: 'm42-vendor-decision-web', img: 'm42-vendor-decision',
      story: 'The app does not track which vendor’s fish went to which customer. The weight difference is shared among the vendors of that fish at that point in proportion to what each said, unless a vendor was weighed on his own. The price is judged on the lowest price the fish sold for (never the average), minus the charges per kg averaged over the buyers of the cheapest size; a vendor whose fish was bought already sorted by size is judged on the lowest price for his size. We open about 5% below and close at his asking price at most, never above it; if his asking price would make a loss, the close is capped at break-even. The average and the other details are shown at a glance.',
      asks: ['Is opening about 5% below the close the right habit?', 'Are the charges averaged over the cheapest size the right ones to use?', 'Which other numbers help the decision?'] },

    { id: 'm07', step: 'close', title: 'Typing the final price', who: ['purchase_mgr', 'admin'], lead: 'purchase_mgr', web: 'm07-price-web', img: 'm07-price',
      story: 'Only when a person types the final price per kg does the purchase order become final. It is never above what the vendor asked. The Purchase Manager or the Admin can type it; the Admin can overwrite anyone, and the app keeps a history of who changed what.',
      asks: ['Q15 Who may type it?', 'Is the vendor paid only after this?'] },

    { id: 'm31', step: 'pay', title: 'What the customer owes', who: ['accounts', 'sales'], adminImg: 'a31-payments', adminWeb: 'a31-payments-web', img: 'm31-account',
      story: 'Each customer has an account: what they owe and when it is due. The developer suggests the same drill-down as stock for what a customer bought (an idea the owner has not seen yet).',
      asks: ['Q42 Show what a customer bought as total → fish → size?'] },

    { id: 'm32', step: 'pay', title: 'Recording a payment', who: ['accounts'], adminImg: 'a31-payments', adminWeb: 'a31-payments-web', img: 'm32-payment',
      story: 'Payments come by bank transfer, UPI, or rarely cash, and may be partial or full.',
      asks: ['Who records payments?'] },

    { id: 'm33', step: 'pay', title: 'Customer priority', who: ['sales', 'admin'], web: 'm33-priority-web', img: 'm33-priority',
      story: 'How fast and how fully a customer pays gives a priority, shown to sales and admin.',
      asks: ['Q33 What does priority decide?'] },

    { id: 'm34', step: 'cost', title: 'Expenses', who: ['admin'], web: 'm34-expenses-web', img: 'm34-expenses',
      story: 'Ice, packing material and transport are recorded by whoever buys them, or filled in automatically, and can be changed by the Admin. They flow into profit and loss.',
      asks: ['Q35 Who records each cost? What is automatic?'] },

    { id: 'm35', step: 'cost', title: 'Salary', who: ['admin'], web: 'm35-salary-web', img: 'm35-salary',
      story: 'Salary, bonus, incentive and absence deductions per employee. Attendance is optional.',
      asks: ['Q36 In this app now? Who may see it?'] },

    { id: 'm36', step: 'cost', title: 'The Admin dashboard', who: ['admin'], web: 'm36-dashboard-web', img: 'm36-dashboard',
      story: 'One page with stock, what is owed, profit by size and costs, filtered by point, customer and dates.',
      asks: ['Q37 The top five numbers you look at each morning and evening'] }

  ]
};
