import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { paymentApi, ClientCreditPackage } from '../services/paymentApi';
import { useToast } from './Toast';

interface PurchaseCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PurchaseCreditsModal({ isOpen, onClose }: PurchaseCreditsModalProps) {
  const { user, token, refreshUser } = useAuth();
  const toast = useToast();

  const [packages, setPackages] = useState<ClientCreditPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('credits_40');
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{
    creditsAwarded: number;
    newBalance: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch available packages when opened
  useEffect(() => {
    if (!isOpen || !token) return;

    let isMounted = true;
    setIsLoadingPackages(true);
    setErrorMessage(null);
    setPurchaseSuccess(null);

    paymentApi
      .getPackages(token)
      .then((pkgs) => {
        if (isMounted) {
          setPackages(pkgs);
          if (pkgs.length > 0) {
            setSelectedPackageId(pkgs[0].id);
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('[PurchaseModal] Failed to load packages:', err);
          setErrorMessage('Unable to load credit packages. Please try again later.');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingPackages(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleCheckout = async () => {
    if (!token || !selectedPackageId || isProcessing) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // 1. Create Razorpay order on backend
      const orderData = await paymentApi.createOrder(token, selectedPackageId);

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Meoow AI',
        description: `${orderData.credits} AI Interview Credits`,
        order_id: orderData.orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        theme: {
          color: '#0284c7',
          backdrop_color: '#ffffff',
        },
      };

      // 2. Open checkout in dedicated non-transparent payment window
      if (window.meow?.openRazorpayCheckout) {
        const result = await window.meow.openRazorpayCheckout(options);
        if (result.success && result.data) {
          try {
            const verifyRes = await paymentApi.verifyPayment(token, {
              orderId: result.data.razorpay_order_id,
              paymentId: result.data.razorpay_payment_id,
              signature: result.data.razorpay_signature,
            });

            await refreshUser();

            setPurchaseSuccess({
              creditsAwarded: verifyRes.creditsAwarded || orderData.credits,
              newBalance: verifyRes.newBalance ?? ((user?.credits ?? 0) + orderData.credits),
            });
            toast.success(`Successfully added ${orderData.credits} credits to your account!`);
          } catch (verifyErr: any) {
            console.error('[PurchaseModal] Payment verification failed:', verifyErr);
            setErrorMessage(
              verifyErr.message || 'Payment verification failed. Please contact support if your account was debited.'
            );
          } finally {
            setIsProcessing(false);
          }
        } else if (result.error) {
          setErrorMessage(result.error);
          setIsProcessing(false);
        } else {
          // User closed / dismissed payment window
          setIsProcessing(false);
        }
      } else {
        // Fallback for browser preview
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          throw new Error('Could not load payment gateway. Please check your internet connection.');
        }

        const fallbackOptions = {
          ...options,
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const verifyRes = await paymentApi.verifyPayment(token, {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              });

              await refreshUser();

              setPurchaseSuccess({
                creditsAwarded: verifyRes.creditsAwarded || orderData.credits,
                newBalance: verifyRes.newBalance ?? ((user?.credits ?? 0) + orderData.credits),
              });
              toast.success(`Successfully added ${orderData.credits} credits to your account!`);
            } catch (verifyErr: any) {
              console.error('[PurchaseModal] Payment verification failed:', verifyErr);
              setErrorMessage(
                verifyErr.message || 'Payment verification failed. Please contact support if your account was debited.'
              );
            } finally {
              setIsProcessing(false);
            }
          },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
            },
          },
        };

        const razorpayInstance = new (window as any).Razorpay(fallbackOptions);
        razorpayInstance.on('payment.failed', (response: any) => {
          setIsProcessing(false);
          setErrorMessage(response.error?.description || 'Payment failed or was declined.');
        });
        razorpayInstance.open();
      }
    } catch (err: any) {
      console.error('[PurchaseModal] Order creation failed:', err);
      setIsProcessing(false);
      setErrorMessage(err.message || 'Failed to initiate checkout. Please try again.');
    }
  };

  return (
    <div className="purchase-modal-overlay" data-window-interactive="true">
      <div className="purchase-modal-container" data-window-interactive="true">
        {/* Header */}
        <div className="purchase-modal-header">
          <div className="purchase-modal-title-group">
            <span className="purchase-modal-badge">⚡ Credits</span>
            <h2 className="purchase-modal-title">Get More AI Credits</h2>
          </div>
          <button
            type="button"
            className="purchase-modal-close"
            onClick={onClose}
            aria-label="Close modal"
            data-window-interactive="true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="purchase-modal-body">
          {purchaseSuccess ? (
            <div className="purchase-success-state">
              <div className="purchase-success-icon">✓</div>
              <h3 className="purchase-success-title">Payment Successful!</h3>
              <p className="purchase-success-desc">
                +{purchaseSuccess.creditsAwarded} credits have been added to your account.
              </p>
              <div className="purchase-new-balance">
                <span>New Available Balance:</span>
                <strong>{purchaseSuccess.newBalance} credits</strong>
              </div>
              <button
                type="button"
                className="purchase-action-button"
                onClick={onClose}
                data-window-interactive="true"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Balance Banner */}
              <div className="purchase-balance-banner">
                <span className="purchase-balance-label">Current Balance:</span>
                <span className="purchase-balance-value">⚡ {user?.credits ?? 0} credits</span>
              </div>

              {errorMessage && (
                <div className="purchase-error-banner">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Package Selection */}
              <div className="purchase-packages-section">
                <span className="purchase-section-label">Select a Package</span>
                {isLoadingPackages ? (
                  <div className="purchase-loading-packages">Loading available packages...</div>
                ) : packages.length === 0 ? (
                  <div className="purchase-no-packages">
                    {/* Fallback default package card */}
                    <div
                      className={`package-card ${selectedPackageId === 'credits_40' ? 'selected' : ''}`}
                      onClick={() => setSelectedPackageId('credits_40')}
                      data-window-interactive="true"
                    >
                      <div className="package-card-header">
                        <div className="package-credits">40 Credits</div>
                        <div className="package-badge">Standard</div>
                      </div>
                      <div className="package-price">₹100</div>
                      <div className="package-subtext">₹2.50 per AI generated answer</div>
                    </div>
                  </div>
                ) : (
                  <div className="purchase-packages-grid">
                    {packages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className={`package-card ${selectedPackageId === pkg.id ? 'selected' : ''}`}
                        onClick={() => setSelectedPackageId(pkg.id)}
                        data-window-interactive="true"
                      >
                        <div className="package-card-header">
                          <div className="package-credits">{pkg.credits} Credits</div>
                          <div className={`package-badge ${pkg.isTest ? 'test-badge' : ''}`}>
                            {pkg.isTest ? 'Test Mode' : 'Instant Delivery'}
                          </div>
                        </div>
                        <div className="package-price">₹{pkg.amountPaise / 100}</div>
                        <div className="package-subtext">
                          ₹{(pkg.amountPaise / 100 / pkg.credits).toFixed(2)} per AI answer
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Security guarantee note */}
              <div className="purchase-security-note">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Secured with Razorpay (UPI, Cards, NetBanking). Credits never expire.</span>
              </div>

              {/* Checkout Button */}
              <button
                type="button"
                className="purchase-action-button"
                onClick={handleCheckout}
                disabled={isProcessing || isLoadingPackages}
                data-window-interactive="true"
              >
                {isProcessing ? (
                  <span className="purchase-button-spinner-row">
                    <span className="purchase-spinner" />
                    <span>Processing Payment...</span>
                  </span>
                ) : (
                  <span>Proceed to Pay (₹{packages.find((p) => p.id === selectedPackageId)?.amountPaise ? (packages.find((p) => p.id === selectedPackageId)!.amountPaise / 100) : 100})</span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

