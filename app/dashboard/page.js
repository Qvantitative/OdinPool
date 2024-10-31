// app/dashboard/page.js

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { request } from 'sats-connect';
import dynamic from 'next/dynamic';

const Navbar = dynamic(() => import('../components/wallet/Navbar'), { ssr: false });
const TrendingCollections = dynamic(() => import('../components/wallet/TrendingCollections'), { ssr: false });
const RunesBalance = dynamic(() => import('../components/wallet/RunesBalance'), { ssr: false });
const InscriptionsGrid = dynamic(() => import('../components/wallet/InscriptionsGrid'), { ssr: false });
const InscriptionModal = dynamic(() => import('../components/wallet/InscriptionModal'), { ssr: false });
const TrendingChart = dynamic(() => import('../components/wallet/charts/TrendingChart'), { ssr: false });
const InscriptionLookup = dynamic(() => import('../components/wallet/InscriptionLookup'), { ssr: false });
const BubbleMaps = dynamic(() => import('../components/wallet/BubbleMaps'), { ssr: false });  // <-- Changed from BubbleChart to BubbleMaps


const ErrorMessage = ({ message }) => <div className="error">{message}</div>;
const LoadingIndicator = () => <div>Loading...</div>;

const Portfolio = () => {
  const [ordinalAddress, setOrdinalAddress] = useState(null);
  const [balance, setBalance] = useState(null);
  const [runesBalance, setRunesBalance] = useState(null);
  const [inscriptions, setInscriptions] = useState([]);
  const [activeInscription, setActiveInscription] = useState(null);
  const [showRunes, setShowRunes] = useState(false);
  const [showTrending, setShowTrending] = useState(true);
  const [showBubbleChart, setShowBubbleChart] = useState(false);
  const [collections, setCollections] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState({});
  const [fpInBTC, setFpInBTC] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [inscriptionStats, setInscriptionStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);
  const [hasFetchedInscriptionStats, setHasFetchedInscriptionStats] = useState(false);
  const [walletMetrics, setWalletMetrics] = useState([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState(null);
  const [projectRankings, setProjectRankings] = useState([]);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [rankingsError, setRankingsError] = useState(null);
  const router = useRouter();

  // Color mapping function
  const getProjectColor = (projectSlug) => {
    const colorMap = {
      'bitcoin-puppets': '#ff7c43',
      'nodemonkes': '#ffa600',
      'basedangels': '#665191',
      'quantum_cats': '#2f4b7c'
    };
    return colorMap[projectSlug] || '#8884d8';
  };

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
      console.log('Fetching inscriptions...');
      const response = await request('ord_getInscriptions', {
        address,
        network: 'mainnet',
        limit: 60,
        offset: 0,
      });

      console.log('Full response:', JSON.stringify(response, null, 2));

      if (response.status === 'success' && response.result && response.result.inscriptions) {
        const filteredInscriptions = response.result.inscriptions.filter(inscription => {
          if (inscription && inscription.contentType) {
            inscription.imageUrl = `https://ordinals.com/inscription/${inscription.id}`;
            return !inscription.contentType.startsWith('text/plain') && !inscription.contentType.startsWith('text/html');
          }
          return false;
        });
        setInscriptions(filteredInscriptions);
        console.log('Filtered inscriptions:', filteredInscriptions);
      } else if (response.status === 'success') {
        console.log('No inscriptions found in the response');
        setInscriptions([]);
      } else {
        console.log('Failed to fetch inscriptions');
        setError(prev => ({ ...prev, inscriptions: 'Failed to fetch inscriptions.' }));
      }
    } catch (error) {
      console.error('Error caught:', error);
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
        setShowTrending(false);
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

  const fetchTrendingCollections = useCallback(async (collectionName) => {
    setLoading(true);
    setError(prev => ({ ...prev, trending: null }));
    try {
      const response = await fetch(`/api/trending-collections?name=${collectionName}`);
      if (!response.ok) {
        throw new Error('Failed to fetch trending collection data');
      }
      const data = await response.json();
      setCollections(prevCollections => {
        const index = prevCollections.findIndex(c => c.name === collectionName);
        if (index !== -1) {
          const newCollections = [...prevCollections];
          newCollections[index] = { ...newCollections[index], ...data };
          return newCollections;
        }
        return [...prevCollections, data];
      });
    } catch (error) {
      // Add error handling here
      //setError(prev => ({ ...prev, trending: 'Failed to fetch trending data.' }));
      console.error('Error fetching trending collections:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInscriptionStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await fetch('http://68.9.235.71:3001/api/wallets/stats');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const projectData = await response.json();

      const transformedData = projectData.map(project => ({
        name: project.project_slug,
        holders: parseInt(project.unique_holders),
        inscriptions: parseInt(project.total_inscriptions),
        z: parseInt(project.total_inscriptions),
        avgPerHolder: parseFloat(project.avg_per_holder),
        fill: getProjectColor(project.project_slug)
      }));

      console.log("Inscription Stats:", transformedData)

      setInscriptionStats(transformedData);
      setStatsLoading(false);
    } catch (err) {
      console.error('Error fetching inscription stats:', err);
      setStatsError(err.message);
      setStatsLoading(false);
    }
  }, [getProjectColor]);

  // Function to fetch wallet metrics
  const fetchWalletMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const response = await fetch('http://68.9.235.71:3001/api/wallet-metrics');
      if (!response.ok) {
        throw new Error('Failed to fetch wallet metrics');
      }
      const data = await response.json();
      console.log('Fetched wallet metrics:', data); // Add this debug log
      setWalletMetrics(data);
    } catch (error) {
      console.error('Error fetching wallet metrics:', error);
      setMetricsError('Failed to fetch wallet metrics data');
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  // In Portfolio.js, update the fetchProjectRankings function:

  const fetchProjectRankings = useCallback(async (projectSlug = null) => {
    setRankingsLoading(true);
    setRankingsError(null);
    try {
      const url = new URL('http://68.9.235.71:3001/api/project-rankings', window.location.origin);
      if (projectSlug) {
        url.searchParams.append('project', projectSlug);
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch project rankings');
      }

      let data = await response.json();

      // Handle both array and object response formats
      if (!Array.isArray(data)) {
        // If we get an object with project keys, get the data for the selected project
        data = data[projectSlug] || [];
      }

      // Transform data to include formatted values
      const transformedData = data.map(ranking => ({
        ...ranking,
        holding_percentage: parseFloat(ranking.holding_percentage).toFixed(2),
        formattedAddress: `${ranking.address.slice(0, 6)}...${ranking.address.slice(-4)}`,
        rank_display: `#${ranking.rank}`
      }));

      console.log('Transformed Rankings:', transformedData);
      setProjectRankings(transformedData);
    } catch (error) {
      console.error('Error fetching project rankings:', error);
      setRankingsError(error.message);
    } finally {
      setRankingsLoading(false);
    }
  }, []);

  const handleCollectionClick = useCallback((collectionName) => {
    setSelectedCollection(collectionName);
    fetchTrendingCollections(collectionName);
  }, [fetchTrendingCollections]);

  const handleWalletChange = useCallback((newAddress) => {
    setOrdinalAddress(newAddress);
    setError({});
    setInscriptions([]);
  }, []);

  const handleSort = useCallback((key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'ascending' ? 'descending' : 'ascending'
    }));
  }, []);

  const sortedCollections = useMemo(() => {
    if (!sortConfig.key) return collections;
    return [...collections].sort((a, b) => {
      return sortConfig.direction === 'ascending'
        ? a[sortConfig.key] - b[sortConfig.key]
        : b[sortConfig.key] - a[sortConfig.key];
    });
  }, [collections, sortConfig]);

  const handleShowOrdinals = useCallback(() => {
      if (ordinalAddress) {
        fetchInscriptions(ordinalAddress);
        setShowTrending(false);
        setShowRunes(false);
        setShowBubbleChart(false);  // Hide BubbleMaps
      }
    }, [ordinalAddress, fetchInscriptions]);

  const handleShowRunes = useCallback(() => {
      fetchRunesBalance();
      setShowTrending(false);
      setShowBubbleChart(false);  // Hide BubbleMaps
  }, [fetchRunesBalance]);

  const handleShowTrending = useCallback(() => {
      setShowTrending(true);
      setShowRunes(false);
      setInscriptions([]);
      setShowBubbleChart(false);  // Hide BubbleMaps
      setError(prev => ({ ...prev, trending: null }));
      fetchTrendingCollections();
      fetchInscriptionStats();
  }, [fetchTrendingCollections, fetchInscriptionStats]);

  const handleShowBubbleChart = useCallback(() => {
      setShowBubbleChart(true);
      setShowTrending(false);
      setShowRunes(false);
      setSelectedCollection(prev => prev || 'bitcoin-puppets');
      fetchProjectRankings(selectedCollection || 'bitcoin-puppets');
  }, [selectedCollection, fetchProjectRankings]);

  const toggleFloorPrice = useCallback(() => {
    setFpInBTC(prev => !prev);
  }, []);

  useEffect(() => {
    if (ordinalAddress) {
      fetchBalance(ordinalAddress);
    }
  }, [ordinalAddress, fetchBalance]);

  useEffect(() => {
    fetchWalletMetrics();
  }, [fetchWalletMetrics]);

  // Fetch rankings when project changes
  useEffect(() => {
    if (selectedCollection) {
      fetchProjectRankings(selectedCollection);
    }
  }, [selectedCollection, fetchProjectRankings]);

  useEffect(() => {
    if (showTrending && !hasFetchedInscriptionStats) {
      setStatsLoading(true);
      fetchInscriptionStats().finally(() => {
        setStatsLoading(false);
        setHasFetchedInscriptionStats(true);
      });
    }
  }, [showTrending, fetchInscriptionStats, hasFetchedInscriptionStats]);

  return (
    <div className="p-4">
      <Navbar
        balance={balance}
        ordinalAddress={ordinalAddress}
        onShowOrdinals={handleShowOrdinals}
        onShowRunes={handleShowRunes}
        onShowTrending={handleShowTrending}
        onWalletChange={handleWalletChange}
        onMint={handleShowBubbleChart}
      />

      {/* Add the InscriptionLookup component near the top */}
      {/* <div className="mb-8">
        <InscriptionLookup />
      </div>*/}

      {Object.values(error).filter(Boolean).length > 0 && (
        <div className="error-messages">
          {Object.values(error).filter(Boolean).map((msg, idx) => (
            <ErrorMessage key={idx} message={msg} />
          ))}
        </div>
      )}

      {loading && <LoadingIndicator />}

      {/* Conditional Rendering for BubbleChart */}
      {showBubbleChart && (
        <BubbleMaps
          projectRankings={projectRankings}
          rankingsLoading={rankingsLoading}
          rankingsError={rankingsError}
          selectedCollection={selectedCollection}
          onCollectionChange={(collection) => {
            setSelectedCollection(collection);
            fetchProjectRankings(collection);
          }}
        />
      )}

      {/* Show Trending Collections */}
      {showTrending && !loading && (
        <>
          <TrendingCollections
            collections={sortedCollections}
            handleSort={handleSort}
            sortConfig={sortConfig}
            toggleFloorPrice={toggleFloorPrice}
            fpInBTC={fpInBTC}
            onCollectionClick={handleCollectionClick}
            inscriptionStats={inscriptionStats}
            statsLoading={statsLoading}
            statsError={statsError}
          />
          {selectedCollection && (
            <TrendingChart collectionName={selectedCollection} />
          )}
        </>
      )}

      {/* Show Runes Balance */}
      {showRunes && runesBalance && !loading && (
        <RunesBalance runesBalance={runesBalance} />
      )}

      {/* Show Inscriptions Grid */}
      {!showRunes && !showTrending && inscriptions.length > 0 && !loading && (
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