"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  Link,
  Tag,
  PlusCircle,
  Copy,
  Check,
  Loader2,
  FileText,
  AlertCircle,
  ClipboardList,
  DollarSign,
  Zap,
  CheckCircle2,
} from "lucide-react";

interface PaymentSectionProps {
  company: {
    CompanyID: string;
    CompanyName?: string;
    CompanyAuthID?: string;
    CompanyPassword?: string;
  } | null;
  license: {
    plan?: string;
  } | null;
}

export default function PaymentSection({
  company,
  license,
}: PaymentSectionProps) {
  const [plans, setPlans] = useState<any[]>([]);
  const [price, setPrice] = useState<number>(0);

  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [baseMonthlyPrice, setBaseMonthlyPrice] = useState<number>(0);

  const [billingTerm, setBillingTerm] = useState("month");
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [allowPromocodes, setAllowPromocodes] = useState(true);
  const [paymentLink, setPaymentLink] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [promocodes, setPromocodes] = useState<any[]>([]);
  const [isCreatingPromo, setIsCreatingPromo] = useState(false);
  const [newPromo, setNewPromo] = useState({
    promoCode: "",
    percentOff: "",
    maxRedemptions: "",
    expiresAt: "",
  });
  const [copied, setCopied] = useState(false);

  // Prefill company details
  useEffect(() => {
    if (company) {
      setCompanyName(company.CompanyName || "");
      setCompanyEmail(company.CompanyAuthID || "");
    }
  }, [company]);
  useEffect(() => {
    if (selectedPlan && plans.length > 0) {
      const selected = plans.find((p) => p.PlanName === selectedPlan);
      if (selected) {
        const match = String(selected.StripeResponseJSON || "").match(
          /\$?(\d+)/
        );
        const numericPrice = match ? Number(match[1]) : 0;
        setBaseMonthlyPrice(numericPrice);
        setPrice(numericPrice);
      }
    }
  }, [selectedPlan, plans]);

  useEffect(() => {
    if (billingTerm === "year") {
      setPrice(Math.round(baseMonthlyPrice * 12 * 0.9)); // Apply 10% discount
    } else {
      setPrice(baseMonthlyPrice);
    }
  }, [billingTerm, baseMonthlyPrice]);

  useEffect(() => {
    if (license?.plan && plans.length > 0) {
      const normalizedLicensePlan = license.plan.trim().toLowerCase();
      const matchedPlan = plans.find(
        (p) => p.PlanName?.trim().toLowerCase() === normalizedLicensePlan
      );

      if (matchedPlan) {
        setSelectedPlan(matchedPlan.PlanName);

        // Use the dedicated PlanPrice field from FileMaker
        const numericPrice = Number(matchedPlan.PlanPrice || 0);

        console.log("Matched Plan Price from FileMaker:", numericPrice);
        // Update both monthly base and display price
        setBaseMonthlyPrice(numericPrice);
        setPrice(numericPrice);
      }
    }
  }, [license, plans]);

  useEffect(() => {
    if (billingTerm === "year") {
      // You can apply discount logic here, e.g., 10% off annual
      setPrice((prev) => Math.round(prev * 12 * 0.9));
    } else if (billingTerm === "month" && selectedPlan && plans.length > 0) {
      const selected = plans.find((p) => p.PlanName === selectedPlan);
      const match = selected?.StripeResponseJSON?.match(/\$?(\d+)/);
      const monthlyPrice = match ? Number(match[1]) : 0;
      setPrice(monthlyPrice);
    }
  }, [billingTerm]);

  useEffect(() => {
    console.log("License plan:", license?.plan);
    if (license?.plan) setSelectedPlan(license.plan);
  }, [license]);

  // Fetch plans from FileMaker
  const fetchPlans = async () => {
    console.log("Fetching plans from FileMaker...");
    try {
      const res = await fetch("https://py-fmd.vercel.app/api/dataApi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic RGV2ZWxvcGVyOmFkbWluYml6",
        },
        body: JSON.stringify({
          fmServer: "kibiz-linux.smtech.cloud",
          method: "getAllRecords",
          methodBody: {
            database: "KiBIAI_Admin",
            layout: "Plans",
            offset: "1",
            limit: "50",
          },
          session: { token: "", required: "" },
        }),
      });

      const data = await res.json();
      console.log("Raw FileMaker Plans Response:", data);

      let list = [];
      if (data.records && Array.isArray(data.records)) {
        list = data.records.map((r: any) => (r.fieldData ? r.fieldData : r));
      } else if (data.response?.data) {
        list = data.response.data.map((r: any) => r.fieldData);
      } else if (data.data?.records) {
        list = data.data.records.map((r: any) =>
          r.fieldData ? r.fieldData : r
        );
      }

      setPlans(list);
      console.log("Extracted Plan List:", list);
    } catch (e) {
      console.error("Error fetching plans:", e);
    }
  };

  const fetchPromocodes = async () => {
    try {
      const res = await fetch("/api/payment/coupon");
      const data = await res.json();
      if (data.success) setPromocodes(data.data.data);
    } catch (e) {
      console.error("Error fetching promocodes:", e);
    }
  };

  useEffect(() => {
    fetchPlans();
    fetchPromocodes();
  }, []);

  const createPrice = async (productId: string) => {
    const payload = {
      unitAmount: Math.round(price * 100),
      currency: "usd",
      interval: billingTerm,
      productId,
    };
    const reqPayload = JSON.stringify(payload);
    try {
      const res = await fetch("/api/payment/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: reqPayload,
      });
      const data = await res.json();
      await logToFileMaker(reqPayload, JSON.stringify(data));
      return data;
    } catch (e) {
      await logToFileMaker(reqPayload, JSON.stringify({ error: e }));
    }
  };

  const generatePaymentLink = async () => {
    setIsGenerating(true);
    setStatus("Creating payment link...");
    setPaymentLink("");

    const selected = plans.find((p) => p.PlanName === selectedPlan);
    if (!selected || !selected.StripeProductID) {
      setStatus("Invalid or unmapped plan.");
      setIsGenerating(false);
      return;
    }

    const priceRes = await createPrice(selected.StripeProductID);
    const priceId = priceRes?.data?.id || priceRes?.id;

    const reqPayload = JSON.stringify({
      priceId,
      quantity: 1,
    });

    try {
      const res = await fetch("/api/payment/generatelink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: reqPayload,
      });
      const data = await res.json();
      await logToFileMaker(reqPayload, JSON.stringify(data));
      if (data.success && (data.data?.url || data.url)) {
        setPaymentLink(data.data?.url || data.url);
        setStatus("Payment link generated successfully.");
      } else {
        console.error("Payment link generation failed:", data);
        setStatus("Error generating payment link.");
      }
    } catch (e) {
      setStatus("Error generating link.");
      await logToFileMaker(reqPayload, JSON.stringify({ error: e }));
    } finally {
      setIsGenerating(false);
    }
  };

  const logToFileMaker = async (req: string, res: string) => {
    try {
      await fetch("https://py-fmd.vercel.app/api/dataApi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic RGV2ZWxvcGVyOmFkbWluYml6",
        },
        body: JSON.stringify({
          fmServer: "kibiz-linux.smtech.cloud",
          method: "createRecord",
          methodBody: {
            database: "KiBIAI_Admin",
            layout: "PaymentLog",
            record: {
              API_Request: req,
              API_Response: res,
            },
          },
          session: { token: "", required: "" },
        }),
      });
    } catch (e) {
      console.error("Failed to log to FileMaker:", e);
    }
  };

  const createPromoCode = async () => {
    setIsCreatingPromo(true);
    const payload = {
      promoCode: newPromo.promoCode,
      percentOff: Number(newPromo.percentOff),
      maxRedemptions: Number(newPromo.maxRedemptions),
      expiresAt: newPromo.expiresAt,
    };
    const reqPayload = JSON.stringify(payload);
    try {
      const res = await fetch("/api/payment/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: reqPayload,
      });
      const data = await res.json();
      await logToFileMaker(reqPayload, JSON.stringify(data));
      if (data.success) {
        fetchPromocodes();
        setNewPromo({
          promoCode: "",
          percentOff: "",
          maxRedemptions: "",
          expiresAt: "",
        });
      }
    } catch (e) {
      await logToFileMaker(reqPayload, JSON.stringify({ error: e }));
    } finally {
      setIsCreatingPromo(false);
    }
  };

  const handleCopy = async () => {
    if (paymentLink) {
      await navigator.clipboard.writeText(paymentLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Payment Management
        </h2>
        <div className="flex items-center gap-2 text-xs text-white">
          <FileText className="w-4 h-4" /> All payment events are logged
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 p-6">
        {/* Left: Payment Controls */}
        <div className="col-span-8 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plan
              </label>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700"
              >
                <option value="">Select a plan</option>
                {plans.map((p) => (
                  <option key={p.PlanName} value={p.PlanName}>
                    {p.PlanName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Billing Term
              </label>
              <select
                value={billingTerm}
                onChange={(e) => setBillingTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700"
              >
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price (USD)
            </label>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className=" border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700"
            />
            <p className="text-xs text-gray-500 mt-1">
              {price > 0 && `$${price.toFixed(2)} / ${billingTerm}`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Email
              </label>
              <input
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="promoToggle"
              type="checkbox"
              checked={allowPromocodes}
              onChange={() => setAllowPromocodes(!allowPromocodes)}
              className="h-4 w-4"
            />
            <label htmlFor="promoToggle" className="text-sm text-gray-700">
              Allow Promocodes
            </label>
          </div>

          <button
            onClick={generatePaymentLink}
            disabled={isGenerating || !selectedPlan}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium shadow-sm"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Link className="w-4 h-4" />
            )}
            {isGenerating ? "Generating..." : "Generate Payment Link"}
          </button>

          {paymentLink && (
            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                value={paymentLink}
                readOnly
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-800"
              />
              <button
                onClick={handleCopy}
                className="p-2 bg-indigo-100 rounded-lg hover:bg-indigo-200 transition"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-indigo-600" />
                )}
              </button>
            </div>
          )}

          {status && (
            <div className="mt-3 text-sm text-gray-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-500" />
              {status}
            </div>
          )}
        </div>

        {/* Right: Promocode Side Panel */}
        <div className="col-span-4 border-l border-gray-200 pl-4">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-gray-800">
              Active Promocodes
            </h3>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 h-64 overflow-y-auto">
            {promocodes.length > 0 ? (
              promocodes.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center py-2 border-b border-gray-100"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {p.code}
                    </p>
                    <p className="text-xs text-gray-500">
                      {p.code.match(/\d+/)?.[0] || 0}% off
                    </p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 text-center mt-4">
                No active promocodes
              </p>
            )}
          </div>

          <div className="mt-4 border-t pt-3">
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-indigo-600" />
              Create New Promocode
            </h4>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Promo Code"
                value={newPromo.promoCode}
                onChange={(e) =>
                  setNewPromo({ ...newPromo, promoCode: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-700"
              />
              <input
                type="number"
                placeholder="% Off"
                value={newPromo.percentOff}
                onChange={(e) =>
                  setNewPromo({ ...newPromo, percentOff: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-700"
              />
              <input
                type="number"
                placeholder="Max Redemptions"
                value={newPromo.maxRedemptions}
                onChange={(e) =>
                  setNewPromo({ ...newPromo, maxRedemptions: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-700"
              />
              <input
                type="datetime-local"
                value={newPromo.expiresAt}
                onChange={(e) =>
                  setNewPromo({ ...newPromo, expiresAt: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-700"
              />
              <button
                onClick={createPromoCode}
                disabled={isCreatingPromo}
                className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white text-sm rounded-lg py-1.5 hover:bg-indigo-700 transition"
              >
                {isCreatingPromo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ClipboardList className="w-4 h-4" />
                )}
                {isCreatingPromo ? "Creating..." : "Create Promocode"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
