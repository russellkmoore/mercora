"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Search, Plus, Edit, Trash2, Percent, Calendar, 
  Users, ShoppingCart, Copy, Eye, Tag, Settings 
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface Promotion {
  id: string;
  code: string;
  name: string;
  description: string;
  type: "percentage" | "fixed_amount" | "free_shipping" | "bogo" | "tiered";
  value: number;
  minimumAmount?: number;
  maxUses?: number;
  currentUses: number;
  validFrom: string;
  validTo: string;
  status: "active" | "inactive" | "expired";
  categories?: string[];
  products?: string[];
  // Enhanced fields
  conditions?: {
    productCategories?: string[];
    productSkus?: string[];
    customerSegments?: string[];
    customerTypes?: string[];
    firstPurchaseOnly?: boolean;
    minimumQuantity?: number;
    maximumQuantity?: number;
  };
  eligibility?: {
    customerSegments?: string[];
    channels?: string[];
    regions?: string[];
    requiresAccount?: boolean;
    perCustomerLimit?: number;
  };
  stackable?: boolean;
  priority?: number;
}

interface PromotionEditorProps {
  promotion: Promotion | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (promotion: Partial<Promotion>) => Promise<void>;
  isNew?: boolean;
}

function PromotionEditor({ promotion, isOpen, onClose, onSave, isNew = false }: PromotionEditorProps) {
  const [formData, setFormData] = useState<Partial<Promotion>>({
    code: "",
    name: "",
    description: "",
    type: "percentage",
    value: 0,
    minimumAmount: 0,
    maxUses: undefined,
    validFrom: new Date().toISOString().split('T')[0],
    validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: "active",
    conditions: {},
    eligibility: {},
    stackable: true,
    priority: 100
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (promotion) {
      setFormData({
        ...promotion,
        validFrom: promotion.validFrom.split('T')[0],
        validTo: promotion.validTo.split('T')[0]
      });
    } else if (isNew) {
      setFormData({
        code: "",
        name: "",
        description: "",
        type: "percentage",
        value: 0,
        minimumAmount: 0,
        maxUses: undefined,
        validFrom: new Date().toISOString().split('T')[0],
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: "active",
        conditions: {},
        eligibility: {},
        stackable: true,
        priority: 100
      });
    }
  }, [promotion, isNew]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...formData,
        validFrom: formData.validFrom + "T00:00:00Z",
        validTo: formData.validTo + "T23:59:59Z"
      });
      onClose();
    } catch (error) {
      console.error("Error saving promotion:", error);
    } finally {
      setSaving(false);
    }
  };

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setFormData({ ...formData, code });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="bg-neutral-800 border-neutral-700 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-neutral-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              {isNew ? "Create New Promotion" : "Edit Promotion"}
            </h2>
            <Button variant="ghost" onClick={onClose} className="text-gray-400">
              ✕
            </Button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[75vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Promotion Name
                </label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Summer Sale 2024"
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Promotion Code
                </label>
                <div className="flex space-x-2">
                  <Input
                    value={formData.code || ""}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="SUMMER20"
                    className="bg-neutral-700 border-neutral-600"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateCode}
                    className="px-3"
                  >
                    Generate
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Discount Type
                </label>
                <Select
                  value={formData.type}
                  onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger className="bg-neutral-700 border-neutral-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage Off</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount Off</SelectItem>
                    <SelectItem value="free_shipping">Free Shipping</SelectItem>
                    <SelectItem value="bogo">Buy One Get One</SelectItem>
                    <SelectItem value="tiered">Tiered Discount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.type !== "free_shipping" && formData.type !== "bogo" && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {formData.type === "percentage" ? "Percentage" : "Amount"} ({formData.type === "percentage" ? "%" : "$"})
                  </label>
                  <Input
                    type="number"
                    value={formData.value || 0}
                    onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                    placeholder={formData.type === "percentage" ? "20" : "50"}
                    className="bg-neutral-700 border-neutral-600"
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Valid From
                </label>
                <Input
                  type="date"
                  value={formData.validFrom || ""}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Valid To
                </label>
                <Input
                  type="date"
                  value={formData.validTo || ""}
                  onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Minimum Order Amount ($)
                </label>
                <Input
                  type="number"
                  value={formData.minimumAmount || 0}
                  onChange={(e) => setFormData({ ...formData, minimumAmount: Number(e.target.value) })}
                  placeholder="0"
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Maximum Uses (optional)
                </label>
                <Input
                  type="number"
                  value={formData.maxUses || ""}
                  onChange={(e) => setFormData({ ...formData, maxUses: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="Unlimited"
                  className="bg-neutral-700 border-neutral-600"
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <Textarea
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe this promotion..."
              rows={3}
              className="bg-neutral-700 border-neutral-600"
            />
          </div>

          {/* Advanced Configuration Sections */}
          <div className="mt-6 space-y-6">
            {/* Product & Category Conditions */}
            <div className="border-t border-neutral-600 pt-6">
              <h4 className="text-sm font-medium text-white mb-4 flex items-center">
                <Tag className="w-4 h-4 mr-2" />
                Product & Category Requirements
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Required Categories (comma-separated)
                  </label>
                  <Input
                    value={formData.conditions?.productCategories?.join(", ") || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      conditions: {
                        ...formData.conditions,
                        productCategories: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                      }
                    })}
                    placeholder="electronics, clothing, books"
                    className="bg-neutral-700 border-neutral-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Specific Product SKUs (comma-separated)
                  </label>
                  <Input
                    value={formData.conditions?.productSkus?.join(", ") || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      conditions: {
                        ...formData.conditions,
                        productSkus: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                      }
                    })}
                    placeholder="PROD-001, PROD-002"
                    className="bg-neutral-700 border-neutral-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Minimum Quantity
                  </label>
                  <Input
                    type="number"
                    value={formData.conditions?.minimumQuantity || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      conditions: {
                        ...formData.conditions,
                        minimumQuantity: e.target.value ? Number(e.target.value) : undefined
                      }
                    })}
                    placeholder="1"
                    className="bg-neutral-700 border-neutral-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Maximum Quantity
                  </label>
                  <Input
                    type="number"
                    value={formData.conditions?.maximumQuantity || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      conditions: {
                        ...formData.conditions,
                        maximumQuantity: e.target.value ? Number(e.target.value) : undefined
                      }
                    })}
                    placeholder="10"
                    className="bg-neutral-700 border-neutral-600"
                  />
                </div>
              </div>
            </div>

            {/* Customer Targeting */}
            <div className="border-t border-neutral-600 pt-6">
              <h4 className="text-sm font-medium text-white mb-4 flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Customer Targeting
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Customer Segments (comma-separated)
                  </label>
                  <Input
                    value={formData.conditions?.customerSegments?.join(", ") || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      conditions: {
                        ...formData.conditions,
                        customerSegments: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                      }
                    })}
                    placeholder="vip, new-customer, loyalty"
                    className="bg-neutral-700 border-neutral-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Customer Types (comma-separated)
                  </label>
                  <Input
                    value={formData.conditions?.customerTypes?.join(", ") || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      conditions: {
                        ...formData.conditions,
                        customerTypes: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                      }
                    })}
                    placeholder="guest, registered, business"
                    className="bg-neutral-700 border-neutral-600"
                  />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="firstPurchaseOnly"
                    checked={formData.conditions?.firstPurchaseOnly || false}
                    onCheckedChange={(checked) => setFormData({
                      ...formData,
                      conditions: {
                        ...formData.conditions,
                        firstPurchaseOnly: !!checked
                      }
                    })}
                  />
                  <label htmlFor="firstPurchaseOnly" className="text-sm text-gray-300">
                    First purchase only
                  </label>
                </div>
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="border-t border-neutral-600 pt-6">
              <h4 className="text-sm font-medium text-white mb-4 flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                Advanced Settings
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Priority (higher = applied first)
                  </label>
                  <Input
                    type="number"
                    value={formData.priority || 100}
                    onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                    placeholder="100"
                    className="bg-neutral-700 border-neutral-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Per-Customer Limit
                  </label>
                  <Input
                    type="number"
                    value={formData.eligibility?.perCustomerLimit || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      eligibility: {
                        ...formData.eligibility,
                        perCustomerLimit: e.target.value ? Number(e.target.value) : undefined
                      }
                    })}
                    placeholder="1"
                    className="bg-neutral-700 border-neutral-600"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="stackable"
                        checked={formData.stackable || false}
                        onCheckedChange={(checked) => setFormData({ ...formData, stackable: !!checked })}
                      />
                      <label htmlFor="stackable" className="text-sm text-gray-300">
                        Stackable
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="requiresAccount"
                        checked={formData.eligibility?.requiresAccount || false}
                        onCheckedChange={(checked) => setFormData({
                          ...formData,
                          eligibility: {
                            ...formData.eligibility,
                            requiresAccount: !!checked
                          }
                        })}
                      />
                      <label htmlFor="requiresAccount" className="text-sm text-gray-300">
                        Account Required
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-neutral-700 flex items-center justify-end space-x-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !formData.name?.trim() || !formData.code?.trim()}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {saving ? "Saving..." : "Save Promotion"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function PromotionManagement() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [filteredPromotions, setFilteredPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [isNewPromotion, setIsNewPromotion] = useState(false);

  const fetchPromotions = async () => {
    try {
      const response = await fetch('/api/promotions');
      if (!response.ok) {
        throw new Error('Failed to fetch promotions');
      }
      
      const promotionsData: Promotion[] = await response.json();
      setPromotions(promotionsData);
      setFilteredPromotions(promotionsData);
    } catch (error) {
      console.error("Error fetching promotions:", error);
      // Show error message to user
      alert("Failed to load promotions. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePromotion = async (promotionData: Partial<Promotion>) => {
    try {
      let response: Response;
      
      if (isNewPromotion) {
        response = await fetch('/api/promotions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(promotionData),
        });
      } else if (selectedPromotion) {
        response = await fetch('/api/promotions', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...promotionData, id: selectedPromotion.id }),
        });
      } else {
        throw new Error('No promotion selected for update');
      }
      
      if (!response.ok) {
        const error: { error?: string } = await response.json();
        throw new Error(error.error || 'Failed to save promotion');
      }
      
      const savedPromotion: Promotion = await response.json();
      
      // Update local state
      if (isNewPromotion) {
        setPromotions([...promotions, savedPromotion]);
        setFilteredPromotions([...filteredPromotions, savedPromotion]);
      } else {
        const updatedPromotions = promotions.map(p => 
          p.id === savedPromotion.id ? savedPromotion : p
        );
        setPromotions(updatedPromotions);
        setFilteredPromotions(updatedPromotions.filter((promotion) =>
          !searchQuery.trim() ||
          promotion.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          promotion.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          promotion.description.toLowerCase().includes(searchQuery.toLowerCase())
        ));
      }
      
    } catch (error) {
      console.error("Error saving promotion:", error);
      alert(`Failed to save promotion: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error; // Re-throw to prevent modal from closing
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this promotion?")) return;
    
    try {
      const response = await fetch(`/api/promotions?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error: { error?: string } = await response.json();
        throw new Error(error.error || 'Failed to delete promotion');
      }
      
      // Update local state
      const updatedPromotions = promotions.filter(p => p.id !== id);
      setPromotions(updatedPromotions);
      setFilteredPromotions(updatedPromotions.filter((promotion) =>
        !searchQuery.trim() ||
        promotion.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        promotion.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        promotion.description.toLowerCase().includes(searchQuery.toLowerCase())
      ));
      
    } catch (error) {
      console.error("Error deleting promotion:", error);
      alert(`Failed to delete promotion: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  const toggleStatus = async (id: string) => {
    const promotion = promotions.find(p => p.id === id);
    if (!promotion) return;
    
    const newStatus = promotion.status === "active" ? "inactive" : "active";
    
    try {
      const response = await fetch('/api/promotions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...promotion,
          id: promotion.id,
          status: newStatus
        }),
      });
      
      if (!response.ok) {
        const error: { error?: string } = await response.json();
        throw new Error(error.error || 'Failed to update promotion status');
      }
      
      const updatedPromotion: Promotion = await response.json();
      
      // Update local state
      const updatedPromotions = promotions.map(p => 
        p.id === id ? updatedPromotion : p
      );
      setPromotions(updatedPromotions);
      setFilteredPromotions(updatedPromotions.filter((promotion) =>
        !searchQuery.trim() ||
        promotion.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        promotion.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        promotion.description.toLowerCase().includes(searchQuery.toLowerCase())
      ));
      
    } catch (error) {
      console.error("Error updating promotion status:", error);
      alert(`Failed to update promotion status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const openEditor = (promotion: Promotion | null = null, isNew = false) => {
    setSelectedPromotion(promotion);
    setIsNewPromotion(isNew);
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setSelectedPromotion(null);
    setIsNewPromotion(false);
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPromotions(promotions);
      return;
    }

    const filtered = promotions.filter((promotion) =>
      promotion.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      promotion.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      promotion.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setFilteredPromotions(filtered);
  }, [searchQuery, promotions]);

  if (loading) {
    return <div className="text-gray-400">Loading promotions...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Search promotions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-64 bg-neutral-800 border-neutral-700"
          />
        </div>
        <Button 
          onClick={() => openEditor(null, true)}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Promotion
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-white">{promotions.length}</div>
          <div className="text-sm text-gray-400">Total Promotions</div>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-green-400">
            {promotions.filter(p => p.status === "active").length}
          </div>
          <div className="text-sm text-gray-400">Active Promotions</div>
        </Card>
      </div>

      {/* Promotions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPromotions.map((promotion) => (
          <Card key={promotion.id} className="bg-neutral-800 border-neutral-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 bg-orange-600/20 rounded-lg flex items-center justify-center">
                <Percent className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={promotion.status === "active" ? "default" : "secondary"}>
                  {promotion.status}
                </Badge>
              </div>
            </div>
            
            <h3 className="text-lg font-semibold text-white mb-2">{promotion.name}</h3>
            <div className="flex items-center space-x-2 mb-3">
              <code className="bg-neutral-700 px-2 py-1 rounded text-orange-400 font-mono text-sm">
                {promotion.code}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyCode(promotion.code)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <p className="text-sm text-gray-400 mb-4">{promotion.description}</p>
            
            <div className="space-y-2 text-xs text-gray-500 mb-4">
              <div className="flex justify-between">
                <span>Valid until:</span>
                <span>{new Date(promotion.validTo).toLocaleDateString()}</span>
              </div>
              {promotion.minimumAmount && (
                <div className="flex justify-between">
                  <span>Min order:</span>
                  <span>${promotion.minimumAmount}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditor(promotion)}
                  className="text-orange-500 hover:text-orange-400"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(promotion.id)}
                  className="text-red-500 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleStatus(promotion.id)}
                className={promotion.status === "active" ? "text-orange-500" : "text-green-500"}
              >
                {promotion.status === "active" ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredPromotions.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-400">
          {searchQuery ? "No promotions found matching your search." : "No promotions available."}
        </div>
      )}

      {/* Promotion Editor Modal */}
      <PromotionEditor
        promotion={selectedPromotion}
        isOpen={showEditor}
        onClose={closeEditor}
        onSave={handleSavePromotion}
        isNew={isNewPromotion}
      />
    </div>
  );
}