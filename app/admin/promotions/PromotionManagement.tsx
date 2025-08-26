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
  Users, ShoppingCart, Copy, Eye, BarChart3 
} from "lucide-react";

interface Promotion {
  id: string;
  code: string;
  name: string;
  description: string;
  type: "percentage" | "fixed_amount" | "free_shipping";
  value: number;
  minimumAmount?: number;
  maxUses?: number;
  currentUses: number;
  validFrom: string;
  validTo: string;
  status: "active" | "inactive" | "expired";
  categories?: string[];
  products?: string[];
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
    status: "active"
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
        status: "active"
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
      <Card className="bg-neutral-800 border-neutral-700 w-full max-w-2xl max-h-[90vh] overflow-hidden">
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
        
        <div className="p-6 overflow-y-auto max-h-[70vh]">
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
                  </SelectContent>
                </Select>
              </div>

              {formData.type !== "free_shipping" && (
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
      // Mock data - replace with actual API call
      const mockPromotions: Promotion[] = [
        {
          id: "1",
          code: "SUMMER20",
          name: "Summer Sale 2024",
          description: "20% off all outdoor gear",
          type: "percentage",
          value: 20,
          minimumAmount: 100,
          maxUses: 1000,
          currentUses: 245,
          validFrom: "2024-06-01T00:00:00Z",
          validTo: "2024-08-31T23:59:59Z",
          status: "active"
        },
        {
          id: "2",
          code: "FREESHIP",
          name: "Free Shipping",
          description: "Free shipping on orders over $75",
          type: "free_shipping",
          value: 0,
          minimumAmount: 75,
          maxUses: undefined,
          currentUses: 892,
          validFrom: "2024-01-01T00:00:00Z",
          validTo: "2024-12-31T23:59:59Z",
          status: "active"
        },
        {
          id: "3",
          code: "WELCOME25",
          name: "New Customer Welcome",
          description: "$25 off first order",
          type: "fixed_amount",
          value: 25,
          minimumAmount: 100,
          maxUses: 500,
          currentUses: 156,
          validFrom: "2024-01-01T00:00:00Z",
          validTo: "2024-12-31T23:59:59Z",
          status: "active"
        }
      ];
      
      setPromotions(mockPromotions);
      setFilteredPromotions(mockPromotions);
    } catch (error) {
      console.error("Error fetching promotions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePromotion = async (promotionData: Partial<Promotion>) => {
    // TODO: Implement API call
    console.log("Saving promotion:", promotionData);
    
    // Mock implementation
    if (isNewPromotion) {
      const newPromotion: Promotion = {
        ...promotionData as Promotion,
        id: Date.now().toString(),
        currentUses: 0
      };
      setPromotions([...promotions, newPromotion]);
    } else if (selectedPromotion) {
      const updatedPromotions = promotions.map(p => 
        p.id === selectedPromotion.id 
          ? { ...p, ...promotionData }
          : p
      );
      setPromotions(updatedPromotions);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this promotion?")) return;
    setPromotions(promotions.filter(p => p.id !== id));
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  const toggleStatus = (id: string) => {
    const updatedPromotions = promotions.map(p => 
      p.id === id 
        ? { ...p, status: (p.status === "active" ? "inactive" : "active") as "active" | "inactive" | "expired" }
        : p
    );
    setPromotions(updatedPromotions);
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-orange-400">
            {promotions.reduce((acc, p) => acc + p.currentUses, 0)}
          </div>
          <div className="text-sm text-gray-400">Total Uses</div>
        </Card>
        <Card className="bg-neutral-800 border-neutral-700 p-4">
          <div className="text-2xl font-bold text-blue-400">
            {Math.round(promotions.reduce((acc, p) => acc + (p.currentUses / (p.maxUses || 1)), 0) / promotions.length * 100) || 0}%
          </div>
          <div className="text-sm text-gray-400">Avg Usage Rate</div>
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
                <span>Usage:</span>
                <span>{promotion.currentUses}{promotion.maxUses ? `/${promotion.maxUses}` : ""}</span>
              </div>
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
                  className="text-blue-500 hover:text-blue-400"
                >
                  <BarChart3 className="w-4 h-4" />
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