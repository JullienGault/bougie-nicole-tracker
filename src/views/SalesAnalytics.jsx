// src/views/SalesAnalytics.jsx
import React, { useState, useEffect } from 'react';
// CHEMIN D'IMPORTATION CORRIGÉ
import { db, collection, query, where, getDocs } from '../services/firebase';

// Icons
import { CircleDollarSign, HandCoins, Package, CheckCircle } from 'lucide-react';

// Components & Utils
import KpiCard from '../components/common/KpiCard';
import { formatPrice } from '../utils/formatters';

const SalesAnalytics = () => {
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth());
    const [isLoading, setIsLoading] = useState(true);
    const [monthlyData, setMonthlyData] = useState({ revenue: 0, commission: 0, netIncome: 0, salesCount: 0, topPos: [], topProducts: [] });

    const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    useEffect(() => {
        const fetchMonthlySales = async () => {
            setIsLoading(true);
            const startDate = new Date(year, month, 1);
            const endDate = new Date(year, month + 1, 1);

            try {
                const posSnapshot = await getDocs(collection(db, 'pointsOfSale'));
                const pointsOfSale = posSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                let allSales = [];

                for (const pos of pointsOfSale) {
                    const salesQuery = query(
                        collection(db, `pointsOfSale/${pos.id}/sales`),
                        where('createdAt', '>=', startDate),
                        where('createdAt', '<', endDate)
                    );
                    const salesSnapshot = await getDocs(salesQuery);
                    const monthSales = salesSnapshot.docs.map(doc => ({
                        ...doc.data(),
                        posName: pos.name,
                        commissionRate: pos.commissionRate
                    }));
                    allSales = allSales.concat(monthSales);
                }
                
                if (allSales.length === 0) {
                    setMonthlyData({ revenue: 0, commission: 0, netIncome: 0, salesCount: 0, topPos: [], topProducts: [] });
                    setIsLoading(false);
                    return;
                }

                let revenue = 0;
                let commission = 0;
                const salesByPos = {};
                const salesByProduct = {};

                allSales.forEach(sale => {
                    revenue += sale.totalAmount;
                    commission += sale.totalAmount * (sale.commissionRate || 0);
                    salesByPos[sale.posName] = (salesByPos[sale.posName] || 0) + sale.totalAmount;
                    const productKey = `${sale.productName} ${sale.scent || ''}`.trim();
                    salesByProduct[productKey] = (salesByProduct[productKey] || 0) + sale.quantity;
                });
                
                const topPos = Object.entries(salesByPos).sort(([,a],[,b]) => b-a).slice(0, 5);
                const topProducts = Object.entries(salesByProduct).sort(([,a],[,b]) => b-a).slice(0, 5);
                
                setMonthlyData({
                    revenue,
                    salesCount: allSales.length,
                    commission,
                    netIncome: revenue - commission,
                    topPos,
                    topProducts
                });

            } catch (error) {
                console.error("Erreur lors de la récupération des ventes mensuelles : ", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMonthlySales();
    }, [year, month]);

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 px-4 sm:px-8">
                <div>
                    <h2 className="text-3xl font-bold text-white">Analyse des Ventes Mensuelles</h2>
                    <p className="text-gray-400">Suivi du chiffre d'affaires global par mois.</p>
                </div>
                <div className="flex gap-4 mt-4 md:mt-0">
                    <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-gray-700 p-2 rounded-lg">
                        {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-gray-700 p-2 rounded-lg">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center p-16"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>
            ) : (
                <div className="px-4 sm:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <KpiCard title="CA Total du Mois" value={formatPrice(monthlyData.revenue)} icon={CircleDollarSign} color="bg-green-600" />
                        <KpiCard title="Commissions du Mois" value={formatPrice(monthlyData.commission)} icon={HandCoins} color="bg-blue-600" />
                        <KpiCard title="Revenu Net Dépôts" value={formatPrice(monthlyData.netIncome)} icon={Package} color="bg-pink-600" />
                        <KpiCard title="Nombre de Ventes" value={monthlyData.salesCount} icon={CheckCircle} color="bg-purple-600" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                        <div className="bg-gray-800 rounded-2xl p-6">
                            <h3 className="text-xl font-bold mb-4">Top Dépôts du Mois (par CA)</h3>
                            {monthlyData.topPos.length > 0 ? <ul>{monthlyData.topPos.map(([name, val])=><li key={name} className="flex justify-between py-2 border-b border-gray-700"><span>{name}</span><strong>{formatPrice(val)}</strong></li>)}</ul> : <p className="text-gray-400">Aucune vente ce mois-ci.</p>}
                        </div>
                        <div className="bg-gray-800 rounded-2xl p-6">
                            <h3 className="text-xl font-bold mb-4">Top Produits du Mois (par Qté)</h3>
                            {monthlyData.topProducts.length > 0 ? <ul>{monthlyData.topProducts.map(([name, qty])=><li key={name} className="flex justify-between py-2 border-b border-gray-700"><span>{name}</span><strong>{qty} Unités</strong></li>)}</ul> : <p className="text-gray-400">Aucune vente ce mois-ci.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesAnalytics;
