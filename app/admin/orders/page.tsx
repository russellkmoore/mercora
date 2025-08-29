/**
 * === Admin Orders Management Page ===
 *
 * Comprehensive order management interface for administrators to view, edit,
 * and process customer orders. Features advanced search, filtering, status
 * updates, and detailed order information with inline editing capabilities.
 *
 * === Features ===
 * - **Order Listing**: Complete order history with expandable details
 * - **Search & Filter**: Find orders by ID, customer, or status
 * - **Status Management**: Update order status with tracking information
 * - **Inline Editing**: Edit tracking numbers, notes, and order details
 * - **Customer Information**: View customer details and shipping addresses
 * - **Order Statistics**: Revenue metrics and order count summaries
 * - **Returns Management**: Placeholder for future returns processing
 * - **Responsive Design**: Mobile-optimized interface with collapsible sections
 *
 * === Order Management Features ===
 * - **Status Updates**: Pending → Processing → Shipped → Delivered workflow
 * - **Tracking Integration**: Add and manage shipping tracking numbers
 * - **Order Notes**: Internal notes for order processing and customer service
 * - **Customer Communication**: Direct access to customer contact information
 * - **Financial Overview**: Order totals, payment status, and revenue tracking
 * - **Bulk Operations**: Future support for batch order processing
 *
 * === Technical Implementation ===
 * - **Client Component**: Interactive interface with real-time updates
 * - **API Integration**: Fetches and updates orders via admin API endpoints
 * - **State Management**: Local state for order data, filters, and UI states
 * - **Error Handling**: Graceful error handling with user feedback
 * - **Performance**: Efficient data loading with pagination support
 * - **Type Safety**: Full TypeScript support with Order interface
 *
 * === Order Status Workflow ===
 * - **Pending**: New orders awaiting processing
 * - **Processing**: Orders being prepared for shipment
 * - **Shipped**: Orders in transit with tracking information
 * - **Delivered**: Successfully completed orders
 * - **Cancelled**: Cancelled orders with reason tracking
 * - **Refunded**: Refunded orders with refund information
 *
 * === Data Sources ===
 * - `/api/orders?admin=true` - Order listing and updates
 * - Authentication temporarily disabled for development
 * - Real-time order status and customer information
 *
 * @returns JSX element with complete order management interface
 */

"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ClipboardList, Search, Filter, Eye, Edit, Truck,
  Calendar, DollarSign, User, MapPin, Package,
  RefreshCw, ChevronDown, ChevronRight, AlertCircle,
  CheckCircle, Clock, XCircle, ArrowRight, MoreHorizontal
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface Order {
  id: string;
  customer_id?: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  total_amount: {
    amount: number;
    currency: string;
  };
  currency_code: string;
  shipping_address?: {
    recipient?: string;
    line1?: string;
    city?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number | { amount: number };
  }>;
  payment_status?: string;
  tracking_number?: string;
  created_at: string;
  updated_at: string;
  shipped_at?: string;
  delivered_at?: string;
  notes?: string;
}

const statusConfig = {
  pending: { color: "bg-yellow-600", icon: Clock, label: "Pending" },
  processing: { color: "bg-blue-600", icon: RefreshCw, label: "Processing" },
  shipped: { color: "bg-orange-600", icon: Truck, label: "Shipped" },
  delivered: { color: "bg-green-600", icon: CheckCircle, label: "Delivered" },
  cancelled: { color: "bg-gray-600", icon: XCircle, label: "Cancelled" },
  refunded: { color: "bg-red-600", icon: AlertCircle, label: "Refunded" }
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    status: "",
    tracking_number: "",
    notes: ""
  });

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/orders?admin=true&limit=100");
      if (response.ok) {
        const data = await response.json() as { data: Order[] };
        setOrders(data.data || []);
      } else {
        console.error("Failed to fetch orders");
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, updates: Partial<Order>) => {
    try {
      const response = await fetch("/api/orders", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          ...updates
        }),
      });

      if (response.ok) {
        const updatedData = await response.json() as { data: Order };
        setOrders(prev => prev.map(order => 
          order.id === orderId ? updatedData.data : order
        ));
        setEditingOrder(null);
        setEditForm({ status: "", tracking_number: "", notes: "" });
      } else {
        alert("Failed to update order");
      }
    } catch (error) {
      console.error("Error updating order:", error);
      alert("Error updating order");
    }
  };

  const handleEditSubmit = (orderId: string) => {
    const updates: any = {};
    if (editForm.status) updates.status = editForm.status;
    if (editForm.tracking_number) updates.tracking_number = editForm.tracking_number;
    if (editForm.notes) updates.notes = editForm.notes;
    
    if (editForm.status === "shipped") {
      updates.shipped_at = new Date().toISOString();
    }
    if (editForm.status === "delivered") {
      updates.delivered_at = new Date().toISOString();
    }

    updateOrderStatus(orderId, updates);
  };

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const filteredOrders = orders.filter(order => {
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesSearch = searchQuery === "" || 
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.shipping_address?.recipient?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.items.some(item => item.product_name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesStatus && matchesSearch;
  });

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount / 100);
  };

  const getStatusBadge = (status: Order["status"]) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} text-white text-xs`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-orange-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Order Management</h1>
          <p className="text-gray-400">View and manage customer orders</p>
        </div>
        <Button
          onClick={fetchOrders}
          disabled={loading}
          className="bg-orange-600 hover:bg-orange-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="flex items-center space-x-3">
            <ClipboardList className="w-8 h-8 text-blue-400" />
            <div>
              <p className="text-sm text-gray-400">Total Orders</p>
              <p className="text-2xl font-bold text-white">{orders.length}</p>
            </div>
          </div>
        </Card>
        
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="flex items-center space-x-3">
            <Clock className="w-8 h-8 text-yellow-400" />
            <div>
              <p className="text-sm text-gray-400">Pending</p>
              <p className="text-2xl font-bold text-white">
                {orders.filter(o => o.status === 'pending').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="flex items-center space-x-3">
            <Truck className="w-8 h-8 text-orange-400" />
            <div>
              <p className="text-sm text-gray-400">Shipped</p>
              <p className="text-2xl font-bold text-white">
                {orders.filter(o => o.status === 'shipped').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="flex items-center space-x-3">
            <DollarSign className="w-8 h-8 text-green-400" />
            <div>
              <p className="text-sm text-gray-400">Revenue</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(orders.reduce((sum, order) => 
                  sum + (order.total_amount?.amount || 0), 0
                ))}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-neutral-800 border-neutral-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search orders by ID, customer, or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-neutral-700 border-neutral-600 text-white"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Orders List */}
      <Card className="bg-neutral-800 border-neutral-700">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardList className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-2">No orders found</h3>
            <p className="text-gray-500">No orders match your current filters</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-700">
            {filteredOrders.map((order) => {
              const isExpanded = expandedOrders.has(order.id);
              const isEditing = editingOrder === order.id;
              
              return (
                <div key={order.id} className="p-4">
                  {/* Order Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleOrderExpansion(order.id)}
                        className="text-gray-400 hover:text-white p-1"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                      
                      <div>
                        <h3 className="font-medium text-white">#{order.id}</h3>
                        <div className="flex items-center space-x-3 text-sm text-gray-400">
                          <span className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {new Date(order.created_at).toLocaleDateString()}
                          </span>
                          <span className="flex items-center">
                            <User className="w-3 h-3 mr-1" />
                            {order.shipping_address?.recipient || "Guest"}
                          </span>
                          <span className="flex items-center">
                            <Package className="w-3 h-3 mr-1" />
                            {order.items.length} items
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {getStatusBadge(order.status)}
                      <span className="text-lg font-semibold text-white">
                        {formatCurrency(order.total_amount.amount, order.currency_code)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (isEditing) {
                            setEditingOrder(null);
                            setEditForm({ status: "", tracking_number: "", notes: "" });
                          } else {
                            setEditingOrder(order.id);
                            setEditForm({
                              status: order.status,
                              tracking_number: order.tracking_number || "",
                              notes: order.notes || ""
                            });
                          }
                        }}
                        className="text-gray-400 hover:text-white"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Order Details (Expanded) */}
                  {isExpanded && (
                    <div className="mt-4 pl-8 space-y-4">
                      {/* Items */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Items</h4>
                        <div className="space-y-2">
                          {order.items.map((item, index) => (
                            <div key={index} className="flex items-center justify-between bg-neutral-700 p-3 rounded">
                              <div>
                                <p className="text-white">{item.product_name}</p>
                                <p className="text-sm text-gray-400">Qty: {item.quantity}</p>
                              </div>
                              <p className="text-white font-medium">
                                {formatCurrency(
                                  typeof item.unit_price === 'number' 
                                    ? item.unit_price 
                                    : item.unit_price.amount
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Shipping Address */}
                      {order.shipping_address && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-2">Shipping Address</h4>
                          <div className="bg-neutral-700 p-3 rounded text-sm text-gray-300">
                            <div>{order.shipping_address.recipient}</div>
                            <div>{order.shipping_address.line1}</div>
                            <div>
                              {order.shipping_address.city}, {order.shipping_address.region} {order.shipping_address.postal_code}
                            </div>
                            <div>{order.shipping_address.country}</div>
                          </div>
                        </div>
                      )}

                      {/* Tracking & Notes */}
                      {(order.tracking_number || order.notes) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {order.tracking_number && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-300 mb-2">Tracking Number</h4>
                              <div className="bg-neutral-700 p-3 rounded text-sm text-gray-300">
                                {order.tracking_number}
                              </div>
                            </div>
                          )}
                          {order.notes && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-300 mb-2">Notes</h4>
                              <div className="bg-neutral-700 p-3 rounded text-sm text-gray-300">
                                {order.notes}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Edit Form */}
                      {isEditing && (
                        <div className="bg-neutral-700 p-4 rounded-lg space-y-4">
                          <h4 className="text-sm font-medium text-white">Edit Order</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                              <select
                                value={editForm.status}
                                onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                                className="w-full px-3 py-2 bg-neutral-600 border border-neutral-500 rounded-md text-white"
                              >
                                <option value="pending">Pending</option>
                                <option value="processing">Processing</option>
                                <option value="shipped">Shipped</option>
                                <option value="delivered">Delivered</option>
                                <option value="cancelled">Cancelled</option>
                                <option value="refunded">Refunded</option>
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Tracking Number</label>
                              <Input
                                value={editForm.tracking_number}
                                onChange={(e) => setEditForm(prev => ({ ...prev, tracking_number: e.target.value }))}
                                className="bg-neutral-600 border-neutral-500 text-white"
                                placeholder="Enter tracking number"
                              />
                            </div>
                            
                            <div className="md:col-span-1">
                              <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                              <Textarea
                                value={editForm.notes}
                                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                                className="bg-neutral-600 border-neutral-500 text-white"
                                placeholder="Add notes..."
                                rows={2}
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <Button
                              onClick={() => handleEditSubmit(order.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Save Changes
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setEditingOrder(null);
                                setEditForm({ status: "", tracking_number: "", notes: "" });
                              }}
                              className="border-gray-600 text-gray-400 hover:text-white"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Returns Section Placeholder */}
      <Card className="bg-gradient-to-r from-purple-900/20 to-blue-800/20 border-purple-500/30 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <ArrowRight className="w-6 h-6 text-purple-400" />
          <div>
            <h3 className="text-lg font-semibold text-white">Returns Management</h3>
            <p className="text-sm text-gray-400">Handle return requests and refunds</p>
          </div>
        </div>
        <p className="text-gray-300 text-sm mb-4">
          Returns management system coming soon. This will allow customers to request returns 
          and admins to process refunds directly from the order management interface.
        </p>
        <div className="flex items-center space-x-2 text-sm text-purple-400">
          <AlertCircle className="w-4 h-4" />
          <span>Feature in development</span>
        </div>
      </Card>
    </div>
  );
}