import React, { useState } from "react";
import { MessageCircle, FileText, HelpCircle, Send, X } from "lucide-react";
import { toast } from "react-toastify";
import API from "../../api";

const QuickActionsCard = ({ clientId, onRequestCreated }) => {
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* New Message Card */}
        <button
          onClick={() => toast.info("Select a project to send a message")}
          className="group bg-white dark:bg-[#191f2b]/70 rounded-xl shadow-xl border border-gray-200 dark:border-[#232945] p-6 hover:border-blue-500 transition-all hover:shadow-2xl hover:shadow-blue-500/20"
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-600/20 flex items-center justify-center mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-600/30 transition-colors border border-blue-300 dark:border-blue-500/30">
              <MessageCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">New Message</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Send a message to your project team
            </p>
          </div>
        </button>

        {/* Request Quote Card */}
        <button
          onClick={() => setShowQuoteModal(true)}
          className="group bg-white dark:bg-[#191f2b]/70 rounded-xl shadow-xl border border-gray-200 dark:border-[#232945] p-6 hover:border-green-500 transition-all hover:shadow-2xl hover:shadow-green-500/20"
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-600/20 flex items-center justify-center mb-4 group-hover:bg-green-200 dark:group-hover:bg-green-600/30 transition-colors border border-green-300 dark:border-green-500/30">
              <FileText className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Request Quote</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Get a quote for your new project
            </p>
          </div>
        </button>

        {/* Get Support Card */}
        <button
          onClick={() => setShowSupportModal(true)}
          className="group bg-white dark:bg-[#191f2b]/70 rounded-xl shadow-xl border border-gray-200 dark:border-[#232945] p-6 hover:border-orange-500 transition-all hover:shadow-2xl hover:shadow-orange-500/20"
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-600/20 flex items-center justify-center mb-4 group-hover:bg-orange-200 dark:group-hover:bg-orange-600/30 transition-colors border border-orange-300 dark:border-orange-500/30">
              <HelpCircle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Get Support</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Need help? Contact our support team
            </p>
          </div>
        </button>
      </div>

      {/* Request Quote Modal */}
      {showQuoteModal && (
        <QuoteRequestModal
          clientId={clientId}
          onClose={() => setShowQuoteModal(false)}
          onSuccess={onRequestCreated}
        />
      )}

      {/* Support Request Modal */}
      {showSupportModal && (
        <SupportRequestModal
          clientId={clientId}
          onClose={() => setShowSupportModal(false)}
          onSuccess={onRequestCreated}
        />
      )}
    </>
  );
};

// Quote Request Modal Component
const QuoteRequestModal = ({ clientId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    projectType: "",
    title: "",
    description: "",
    budget: "",
    currency: "USD", // Default currency
    timeline: "",
  });

  const projectTypes = [
    "Website",
    "SEO",
    "Google Marketing",
    "SMO",
    "Hosting",
    "Invoice App",
    "Other",
  ];

  const currencies = [
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "AUD", symbol: "A$", name: "Australian Dollar" },
    { code: "INR", symbol: "₹", name: "Indian Rupee" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "GBP", symbol: "£", name: "British Pound" },
    { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  ];

  const getCurrencySymbol = () => {
    return currencies.find(c => c.code === formData.currency)?.symbol || "$";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      await API.post("/api/client-requests", {
        type: "quote",
        ...formData,
      });

      toast.success("Quote request submitted successfully! We'll get back to you soon.");
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error submitting quote request:", error);
      toast.error(error.response?.data?.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#232945]">
          <h2 className="text-xl font-bold text-white">Request a Quote</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Project Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Project Type <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.projectType}
              onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
              className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-green-500 transition-colors"
              required
            >
              <option value="">Select project type</option>
              {projectTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Project Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., E-commerce Website Development"
              className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Project Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your project requirements in detail..."
              rows={4}
              className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors resize-none"
              required
            />
          </div>

          {/* Budget and Currency */}
          <div className="grid grid-cols-2 gap-3">
            {/* Budget */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Budget (Optional)
              </label>
              <input
                type="text"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                placeholder={`e.g., ${getCurrencySymbol()}5,000 - ${getCurrencySymbol()}10,000`}
                className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-green-500 transition-colors"
              >
                {currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.symbol} {currency.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Expected Timeline (Optional)
            </label>
            <input
              type="text"
              value={formData.timeline}
              onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
              placeholder="e.g., 2-3 months"
              className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-600/20 hover:bg-gray-600/40 text-gray-300 rounded-lg transition-colors border border-gray-500/30"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Support Request Modal Component
const SupportRequestModal = ({ clientId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: "",
    priority: "medium",
    title: "",
    description: "",
  });

  const categories = [
    "Technical Issue",
    "Billing Question",
    "Project Inquiry",
    "Account Access",
    "Feature Request",
    "Other",
  ];

  const priorities = [
    { value: "low", label: "Low", color: "text-gray-400" },
    { value: "medium", label: "Medium", color: "text-yellow-400" },
    { value: "high", label: "High", color: "text-orange-400" },
    { value: "urgent", label: "Urgent", color: "text-red-400" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title || !formData.description || !formData.category) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      await API.post("/api/client-requests", {
        type: "support",
        ...formData,
      });

      toast.success("Support request submitted successfully! We'll assist you shortly.");
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error submitting support request:", error);
      toast.error(error.response?.data?.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#232945]">
          <h2 className="text-xl font-bold text-white">Get Support</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Category <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-orange-500 transition-colors"
              required
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Priority <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {priorities.map((priority) => (
                <button
                  key={priority.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: priority.value })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                    formData.priority === priority.value
                      ? "bg-orange-600/30 border-orange-500 " + priority.color
                      : "bg-[#0f1419] border-[#232945] text-gray-400 hover:bg-white/5"
                  }`}
                >
                  {priority.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Subject <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief description of your issue"
              className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Details <span className="text-red-400">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide as much detail as possible to help us assist you better..."
              rows={5}
              className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors resize-none"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-600/20 hover:bg-gray-600/40 text-gray-300 rounded-lg transition-colors border border-gray-500/30"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickActionsCard;
