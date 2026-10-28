export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number; }

export type OrderStatus = 'Pending' | 'Confirmed' | 'PlacedWithVendor' | 'Dispatched' | 'OutForDelivery' | 'Delivered' | 'Cancelled' | 'Returned';
export type PaymentStatus = 'Pending' | 'PartiallyPaid' | 'Paid' | 'Failed' | 'Refunded' | 'PartiallyRefunded';
export type PaymentMethod = 'CashOnDelivery' | 'Razorpay' | 'BankTransfer' | 'Upi';
export type BillPaymentStatus = 'Unpaid' | 'PartiallyPaid' | 'Paid';
export type RefundStatus = 'Requested' | 'Approved' | 'Rejected' | 'Processed';
export type ExpenseCategory = 'Marketing' | 'Advertising' | 'Packaging' | 'Delivery' | 'PaymentGatewayFees' | 'SoftwareHosting'
  | 'Salary' | 'Rent' | 'Utilities' | 'Legal' | 'Miscellaneous';

export interface User { id: number; fullName: string; email: string; phone?: string; role: string; }
export interface AuthResponse { token: string; expiresAt: string; user: User; }

export interface ProductRow {
  id: number; name: string; slug: string; imageUrl?: string; categoryId: number; categoryName: string;
  vendorPrice: number; gstRate: number; vendorCost: number; sellingPrice: number; mrp: number; margin: number; marginPercent: number; previousVendorPrice?: number;
  isActive: boolean; isAvailable: boolean; isFeatured: boolean; vendorPriceChanged: boolean; variantsCount: number;
  source: 'Vendor' | 'Manual'; commissionPercentOverride?: number; soldCount: number; ratingAverage: number;
  lastSyncedAt?: string; createdAt: string;
  social?: Partial<Record<'Instagram' | 'Facebook' | 'Threads' | 'InstagramReel' | 'FacebookReel' | 'ThreadsVideo' | 'InstagramStory' | 'FacebookStory', string>>;
}

export interface AdminVariant {
  id?: number; name: string; sku?: string; vendorMrp: number; vendorPrice: number; mrp: number; sellingPrice: number;
  isAvailable: boolean; isActive: boolean; options?: string[]; vendorName?: string | null; isCopy?: boolean;
}
export interface AdminOptionValue {
  id: number; value: string; colorCode?: string | null; vendorValue?: string | null; vendorColorCode?: string | null;
  fromVendor: boolean; isCustomized: boolean; isHidden: boolean; sortOrder: number; variants: number;
}
export interface AdminOption { id: number; name: string; vendorName?: string | null; isColour: boolean; isCustomized: boolean; position: number; fromVendor: boolean; values: AdminOptionValue[]; }
export interface AdminImage { id: number; url: string; thumbnailUrl?: string; isLocal: boolean; mediaType: number; sortOrder: number; variantId?: number; }

export interface ProductDetail {
  vendorCost: number; vendorPricesIncludeGst: boolean;
  id: number; name: string; slug: string; description?: string; descriptionHtml?: string; categoryId: number; vendorId?: number;
  brand?: string; sku?: string; hsnCode?: string; gstRate: number; material?: string; dimensions?: string; warranty?: string;
  deliveryDays: number; assemblyIncluded: boolean; vendorMrp: number; vendorPrice: number; previousVendorPrice?: number; vendorPriceChanged: boolean;
  mrp: number; sellingPrice: number; commissionPercentOverride?: number | null; effectiveCommission: number; manualPrice: boolean;
  isActive: boolean; isAvailable: boolean; isFeatured: boolean; lockContent: boolean; source: string; vendorProductId?: number; vendorUrl?: string;
  lastSyncedAt?: string; metaTitle?: string; metaDescription?: string; collectionIds: number[]; tagIds: number[];
  images: AdminImage[]; variants: AdminVariant[]; soldCount: number; ratingAverage: number; ratingCount: number;
  options?: AdminOption[];
}

export interface Lookups {
  categories: { id: number; name: string }[];
  collections: { id: number; name: string }[];
  tags: { id: number; name: string; color: string }[];
  vendors: { id: number; name: string }[];
}

export interface CategoryRow {
  id: number; name: string; slug: string; description?: string; imageUrl?: string; sortOrder: number; isActive: boolean; showOnHome: boolean;
  commissionPercent?: number | null; productCount: number; activeCount: number; vendorCategoryId?: number;
}

export interface OrderRow {
  id: number; orderNumber: string; createdAt: string; userId: number; customer: string; phone: string; city: string; pincode: string;
  status: OrderStatus; paymentStatus: PaymentStatus; paymentMethod: PaymentMethod; total: number; amountPaid: number; estimatedCost: number;
  itemCount: number; hasPurchaseOrder: boolean; hasVendorBill: boolean; hasInvoice: boolean; channel: SalesChannel;
}
export type SalesChannel = 'Website' | 'Instagram' | 'Facebook' | 'WhatsApp' | 'Phone' | 'WalkIn' | 'Other';
export const CHANNEL_ICON: Record<SalesChannel, string> = {
  Website: 'bi-globe', Instagram: 'bi-instagram', Facebook: 'bi-facebook', WhatsApp: 'bi-whatsapp', Phone: 'bi-telephone', WalkIn: 'bi-shop', Other: 'bi-three-dots'
};
export const CHANNEL_LABEL: Record<SalesChannel, string> = {
  Website: 'Website', Instagram: 'Instagram', Facebook: 'Facebook', WhatsApp: 'WhatsApp', Phone: 'Phone call', WalkIn: 'Walk-in / showroom', Other: 'Other'
};

export interface OrderDetail {
  id: number; orderNumber: string; createdAt: string; status: OrderStatus; paymentStatus: PaymentStatus; paymentMethod: PaymentMethod;
  userId: number; customerName: string; customerEmail: string; customerPhone?: string;
  shipName: string; shipPhone: string; shipEmail?: string; shipLine1: string; shipLine2?: string; shipLandmark?: string; shipCity: string; shipState: string; shipPincode: string;
  customerGstin?: string; subTotal: number; discount: number; couponCode?: string; shippingFee: number; codFee: number; total: number; taxAmount: number;
  amountPaid: number; estimatedCost: number; actualCost: number; costIsActual: boolean; estimatedProfit: number;
  customerNotes?: string; adminNotes?: string; expectedDeliveryDate?: string; deliveredAt?: string; trackingNumber?: string; courierName?: string;
  cancelReason?: string; razorpayOrderId?: string;
  items: {
    id: number; productId: number; variantId?: number; productName: string; variantName?: string; imageUrl?: string; quantity: number;
    unitMrp: number; unitPrice: number; lineTotal: number; unitVendorPrice: number; unitVendorCost: number; gstRate: number; hsnCode?: string; vendorProductId?: number; vendorUrl?: string;
  }[];
  history: { id: number; status: OrderStatus; note?: string; visibleToCustomer: boolean; createdBy?: string; createdAt: string }[];
  payments: { id: number; method: PaymentMethod; amount: number; isSuccessful: boolean; gatewayPaymentId?: string; reference?: string; paidAt: string; notes?: string }[];
  refunds: RefundRow[];
  purchaseOrder?: {
    id: number; poNumber: string; vendorId: number; vendorName: string; vendorWhatsApp?: string; status: string; expectedCost: number;
    vendorReference?: string; notes?: string; sentAt?: string; expectedDispatchDate?: string;
  };
  vendorBills: { id: number; billNumber: string; billDate: string; totalAmount: number; taxableAmount: number; amountPaid: number; paymentStatus: BillPaymentStatus; fileUrl?: string }[];
  invoices: { id: number; invoiceNumber: string; invoiceDate: string; total: number; isCancelled: boolean; isTaxInvoice: boolean }[];
  nextStatuses: OrderStatus[];
  paymentProvider?: string; upiAmount?: number; customerUtr?: string;
  originalDeliveryDate?: string | null; deliveryDateReason?: string | null; deliveryDateChangedAt?: string | null;
  channel: SalesChannel; channelReference?: string | null; createdByStaff?: string | null;
  shipLatitude?: number | null; shipLongitude?: number | null; mapUrl?: string | null;
}

export interface RefundRow {
  id: number; orderId?: number; orderNumber?: string; customer?: string; type: string; status: RefundStatus; amount: number; reason: string;
  customerComment?: string; adminNotes?: string; reference?: string; createdAt: string; processedAt?: string; paymentMethod?: PaymentMethod; paymentProvider?: string;
}

export interface CustomerRow { id: number; fullName: string; email: string; phone?: string; isActive: boolean; isGuest: boolean; orders: number; totalSpent: number; lastOrderAt?: string; createdAt: string; city?: string; }

export interface Address { id: number; label: string; fullName: string; phone: string; line1: string; line2?: string; landmark?: string; city: string; state: string; pincode: string; isDefault: boolean; }
export interface OrderSummary { id: number; orderNumber: string; createdAt: string; status: OrderStatus; paymentStatus: PaymentStatus; paymentMethod: PaymentMethod; total: number; itemCount: number; firstItemImage?: string; firstItemName?: string; }

export interface CustomerDetail {
  id: number; fullName: string; email: string; phone?: string; isActive: boolean; isGuest: boolean; notes?: string; createdAt: string; lastLoginAt?: string;
  orders: number; totalSpent: number; avgOrderValue: number; wishlistCount: number; cartCount: number;
  addresses: Address[]; recentOrders: OrderSummary[]; reviews: { id: number; rating: number; title?: string; comment?: string; isApproved: boolean; createdAt: string; product: string }[];
}

export interface Vendor {
  id: number; name: string; contactPerson?: string; phone?: string; whatsApp?: string; email?: string; address?: string; city?: string; state?: string;
  gstin?: string; website?: string; bankDetails?: string; paymentTerms?: string; externalStoreId?: number; syncEnabled: boolean; isActive: boolean;
  products?: number; outstandingAmount?: number; totalPurchases?: number;
}

export interface SyncProgress { isRunning: boolean; stage: string; total: number; processed: number; logId?: number; startedAt?: string; lastError?: string; }
export interface SyncLog {
  id: number; vendorId: number; startedAt: string; finishedAt?: string; status: 'Running' | 'Completed' | 'Failed'; productsFound: number; productsAdded: number;
  productsUpdated: number; priceChanges: number; productsDeactivated: number; imagesDownloaded: number; message?: string;
}

export interface VendorBill {
  id: number; vendorId: number; vendorName: string; orderId?: number; orderNumber?: string; billNumber: string; billDate: string; dueDate?: string;
  taxableAmount: number; gstAmount: number; shippingCharges: number; totalAmount: number; amountPaid: number; paymentStatus: BillPaymentStatus;
  lastPaidOn?: string; paymentReference?: string; fileUrl?: string; notes?: string;
}

export interface InvoiceRow { id: number; invoiceNumber: string; invoiceDate: string; orderId: number; orderNumber: string; billToName: string; taxableAmount: number; cgst: number; sgst: number; igst: number; total: number; isCancelled: boolean; isTaxInvoice: boolean; }

export interface Expense { id: number; date: string; category: ExpenseCategory; description: string; amount: number; gstAmount: number; paidTo?: string; paymentMode?: string; reference?: string; orderId?: number; receiptUrl?: string; }

export interface NameValue { name: string; value: number; count: number; }
export interface DashboardOffer {
  id: number; name: string; slug: string; themeColor: string; status: 'live' | 'upcoming' | 'ended' | 'off';
  startsAt: string; endsAt: string; productsOnOffer: number;
  stats: { orders: number; units: number; revenue: number; discountGiven: number; margin: number };
}

export interface Dashboard {
  kpis: { sales: number; prevSales: number; orders: number; prevOrders: number; avgOrderValue: number; newCustomers: number; prevNewCustomers: number; estimatedProfit: number; prevEstimatedProfit: number };
  salesSeries: { label: string; value: number; value2: number }[];
  statusBreakdown: NameValue[]; topProducts: NameValue[]; salesByCategory: NameValue[]; topAreas: NameValue[]; paymentMethods: NameValue[];
  recentOrders: { id: number; orderNumber: string; customer: string; createdAt: string; total: number; status: OrderStatus; paymentStatus: PaymentStatus; city: string }[];
  actions: {
    ordersToConfirm: number; ordersToPlaceWithVendor: number; ordersInTransit: number; pendingRefunds: number; unpaidVendorBills: number; unpaidVendorAmount: number;
    priceChangedProducts: number; unavailableActiveProducts: number; newEnquiries: number; pendingReviews: number; deliveredWithoutInvoice: number; codToCollect: number;
  };
  activeProducts: number; totalCustomers: number;
  offers?: DashboardOffer[];
  channels?: NameValue[];
}

export interface ProfitLoss {
  from: string; to: string; gstRegistered: boolean;
  grossSales: number; outputGst: number; refunds: number; netRevenue: number;
  costOfGoods: number; estimatedCostPortion: number; otherPurchases: number; grossProfit: number; grossMarginPercent: number;
  expenses: { label: string; amount: number }[]; totalExpenses: number; netProfit: number; netMarginPercent: number;
  inputGst: number; netGstPayable: number; cashReceived: number; cashPaidToVendors: number; cashExpenses: number; receivables: number; payables: number;
  ordersCount: number; monthly: { month: string; revenue: number; cogs: number; expenses: number; netProfit: number }[];
  orders: { orderId: number; orderNumber: string; date: string; customer: string; revenue: number; cost: number; costIsEstimated: boolean; profit: number; marginPercent: number }[];
  offerDiscounts?: number; couponDiscounts?: number;
}

export interface Coupon {
  id: number; code: string; description?: string; discountType: 'Percent' | 'Flat'; value: number; maxDiscount?: number | null; minOrderAmount: number;
  startsAt?: string | null; endsAt?: string | null; usageLimit?: number | null; usedCount: number; perUserLimit?: number | null; isActive: boolean;
}

export interface Banner { id: number; title: string; subtitle?: string; imageUrl: string; linkUrl?: string; buttonText?: string; sortOrder: number; isActive: boolean; }
export interface Pincode { id: number; pincode: string; city: string; area?: string; deliveryDays: number; deliveryDaysMax?: number | null; extraCharge: number; codAvailable: boolean; isActive: boolean; }

export interface BusinessSettings {
  id: number; businessName: string; legalName?: string; tagline?: string; gstRegistered: boolean; gstin?: string; pan?: string;
  addressLine1: string; addressLine2?: string; city: string; state: string; stateCode: string; pincode: string; phone: string; whatsApp?: string; email: string;
  website?: string; logoUrl?: string; invoicePrefix: string; invoiceTerms?: string; bankDetails?: string; upiId?: string;
  defaultCommissionPercent: number; defaultGstRate: number; vendorPricesIncludeGst: boolean; priceRounding: 'None' | 'Nearest10' | 'EndWith99' | 'Nearest100';
  shippingFee: number; freeShippingThreshold: number; codEnabled: boolean; codFee: number; codMaxOrderAmount: number;
  restrictToServiceablePincodes: boolean; defaultDeliveryDays: number; instagramUrl?: string; facebookUrl?: string; youtubeUrl?: string;
  createdAt?: string;
  mapsEnabled: boolean; googleMapsApiKey?: string | null;
}
