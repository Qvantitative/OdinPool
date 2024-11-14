// app/dashboard/page.js

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { request } from 'sats-connect';
import dynamic from 'next/dynamic';

const Navbar = dynamic(() => import('../../components/wallet/Navbar'), { ssr: false });
const RunesBalance = dynamic(() => import('../../components/wallet/RunesBalance'), { ssr: false });
const InscriptionsGrid = dynamic(() => import('../../components/wallet/InscriptionsGrid'), { ssr: false });
const InscriptionModal = dynamic(() => import('../../components/wallet/InscriptionModal'), { ssr: false });

const ErrorMessage = ({ message }) => <div className="error">{message}</div>;
const LoadingIndicator = () => <div>Loading...</div>;

const Portfolio = () => {
  const [ordinalAddress, setOrdinalAddress] = useState(null);
  const [balance, setBalance] = useState(null);
  const [runesBalance, setRunesBalance] = useState(null);
  const [inscriptions, setInscriptions] = useState([]);
  const [activeInscription, setActiveInscription] = useState(null);
  const [showRunes, setShowRunes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState({});
  const router = useRouter();

  useEffect(() => {
    const checkWalletConnection = () => {
      if (typeof window !== 'undefined') {
        const accountData = JSON.parse(sessionStorage.getItem('accountData'));
        if (!accountData) {
          router.push('/landingPage');
        } else {
          const ordinalAccount = accountData.find(account => account.purpose === "ordinals");
          if (ordinalAccount) {
            setOrdinalAddress(ordinalAccount.address);
          } else {
            setError(prev => ({ ...prev, account: 'No ordinal address found.' }));
          }
        }
      }
    };

    checkWalletConnection();
  }, [router]);

  const fetchBalance = useCallback(async (address) => {
    setLoading(true);
    try {
      const response = await request('getBalance', { address, network: 'mainnet' });
      if (response.status === 'success') {
        const balanceInBTC = response.result.total / 100000000;
        setBalance(balanceInBTC.toFixed(8));
      } else {
        setError(prev => ({ ...prev, balance: 'Failed to fetch balance.' }));
      }
    } catch (error) {
      setError(prev => ({ ...prev, balance: 'Error fetching balance.' }));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInscriptions = useCallback(async (address) => {
    setLoading(true);
    setError(prev => ({ ...prev, inscriptions: null }));
    try {
      const response = await request('ord_getInscriptions', {
        address,
        network: 'mainnet',
        limit: 60,
        offset: 0,
      });

      if (response.status === 'success' && response.result && response.result.inscriptions) {
        const filteredInscriptions = response.result.inscriptions.filter(inscription => {
          if (inscription && inscription.contentType) {
            inscription.imageUrl = `https://ordinals.com/inscription/${inscription.id}`;
            return !inscription.contentType.startsWith('text/plain') && !inscription.contentType.startsWith('text/html');
          }
          return false;
        });
        setInscriptions(filteredInscriptions);
      } else if (response.status === 'success') {
        setInscriptions([]);
      } else {
        setError(prev => ({ ...prev, inscriptions: 'Failed to fetch inscriptions.' }));
      }
    } catch (error) {
      setError(prev => ({ ...prev, inscriptions: 'Error fetching inscriptions.' }));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRunesBalance = useCallback(async () => {
    setLoading(true);
    try {
      const response = await request('runes_getBalance', null);
      if (response.status === 'success') {
        setRunesBalance(response.result.balances);
        setShowRunes(true);
        setInscriptions([]);
      } else {
        setError(prev => ({ ...prev, runes: 'Failed to fetch Runes balance.' }));
      }
    } catch (error) {
      setError(prev => ({ ...prev, runes: 'Error fetching Runes balance.' }));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleWalletChange = useCallback((newAddress) => {
    setOrdinalAddress(newAddress);
    setError({});
    setInscriptions([]);
  }, []);

  const handleShowOrdinals = useCallback(() => {
    if (ordinalAddress) {
      fetchInscriptions(ordinalAddress);
      setShowRunes(false);
    }
  }, [ordinalAddress, fetchInscriptions]);

  const handleShowRunes = useCallback(() => {
    fetchRunesBalance();
  }, [fetchRunesBalance]);

  useEffect(() => {
    if (ordinalAddress) {
      fetchBalance(ordinalAddress);
    }
  }, [ordinalAddress, fetchBalance]);

  return (
    <div className="p-4">
      <Navbar
        balance={balance}
        ordinalAddress={ordinalAddress}
        onShowOrdinals={handleShowOrdinals}
        onShowRunes={handleShowRunes}
        onWalletChange={handleWalletChange}
      />

      {Object.values(error).filter(Boolean).length > 0 && (
        <div className="error-messages">
          {Object.values(error).filter(Boolean).map((msg, idx) => (
            <ErrorMessage key={idx} message={msg} />
          ))}
        </div>
      )}

      {loading && <LoadingIndicator />}

      {/* Show Runes Balance */}
      {showRunes && runesBalance && !loading && (
        <RunesBalance runesBalance={runesBalance} />
      )}

      {/* Show Inscriptions Grid */}
      {!showRunes && inscriptions.length > 0 && !loading && (
        <InscriptionsGrid
          inscriptions={inscriptions}
          setActiveInscription={setActiveInscription}
        />
      )}

      {/* Inscription Modal */}
      {activeInscription && (
        <InscriptionModal
          inscription={activeInscription}
          onClose={() => setActiveInscription(null)}
        />
      )}
    </div>
  );
};

export default Portfolio;