// src/hooks/useCostCalculator.js
import { useMemo } from 'react';

const calculateForMode = (mode, commonData) => {
    const { recipe, packaging, margin: marginStr, tva: tvaStr, charges, fees: feesStr, depotCommission: depotCommissionStr, shipping, service } = commonData;
    
    const margin = parseFloat(marginStr) || 0;
    const tva = parseFloat(tvaStr) || 0;
    const fees = parseFloat(feesStr) || 0;
    const depotCommission = parseFloat(depotCommissionStr) || 0;

    const productCost = recipe.reduce((acc, item) => acc + (item.standardizedPrice * item.quantity), 0);
    const packagingCost = packaging.reduce((acc, item) => acc + (item.standardizedPrice * item.quantity), 0);
    const productPriceHT = productCost * margin;
    const productPriceTTC = productPriceHT * (1 + tva / 100);

    let finalClientPrice = productPriceTTC;
    let shippingProviderCost = 0;
    let totalExpenses = 0;
    let finalProfit = 0;
    let transactionFees = 0;
    let businessCharges = 0;
    let commissionAmount = 0;
    
    const productWeight = recipe.reduce((acc, item) => {
        const quantity = item.quantity || 0;
        if (item.purchaseUnit === 'piece') {
            return acc + (quantity * (item.weightPerPiece || 0));
        }
        const density = item.density || 1;
        return acc + (quantity * density);
    }, 0);

    const packagingWeight = packaging.reduce((acc, item) => {
        const quantity = item.quantity || 0;
        if (item.purchaseUnit === 'piece') {
            return acc + (quantity * (item.weightPerPiece || 0));
        }
        const density = item.density || 1;
        return acc + (quantity * density);
    }, 0);
    
    const finalPackageWeight = productWeight + packagingWeight;
    
    if (mode === 'internet') {
        let shippingCustomerPrice = 0;
        if (finalPackageWeight > 0) {
            const applicableRate = shipping
                .filter(rate => rate.service === service)
                .sort((a, b) => a.maxWeight - b.maxWeight) // Assurer le tri
                .find(rate => finalPackageWeight <= rate.maxWeight);

            if(applicableRate) {
                shippingProviderCost = applicableRate.cost;
                shippingCustomerPrice = applicableRate.price;
            }
        }

        finalClientPrice = productPriceTTC + shippingCustomerPrice;
        transactionFees = finalClientPrice * (fees / 100);
        businessCharges = productPriceHT * (charges / 100);
        totalExpenses = productCost + packagingCost + shippingProviderCost + transactionFees + businessCharges;
        finalProfit = finalClientPrice - totalExpenses;
    } else if (mode === 'domicile') {
        transactionFees = finalClientPrice * (fees / 100);
        businessCharges = productPriceHT * (charges / 100);
        // Le coût de l'emballage est exclu pour la vente à domicile
        totalExpenses = productCost + transactionFees + businessCharges;
        finalProfit = finalClientPrice - totalExpenses;
    } else if (mode === 'depot') {
        commissionAmount = productPriceTTC * (depotCommission / 100);
        const netRevenueHT = productPriceHT * (1 - (depotCommission / (1 + tva/100) ) / 100);
        businessCharges = netRevenueHT * (charges / 100);
        // CORRECTION : Le coût de l'emballage d'expédition est maintenant aussi exclu pour le dépôt-vente
        totalExpenses = productCost + commissionAmount + businessCharges;
        finalProfit = productPriceTTC - totalExpenses;
    }
    
    return { productCost, packagingCost, productPriceHT, productPriceTTC, finalClientPrice, totalExpenses, finalProfit, transactionFees, businessCharges, shippingProviderCost, commissionAmount, finalPackageWeight };
};


export const useCostCalculator = ({
    saleMode,
    recipeItems,
    packagingItems,
    shippingRates,
    shippingService,
    marginMultiplier,
    tvaRate,
    feesRate,
    depotCommissionRate,
    chargesRate
}) => {
    const calculations = useMemo(() => {
        const commonData = {
            recipe: recipeItems,
            packaging: packagingItems,
            margin: marginMultiplier,
            tva: tvaRate,
            charges: chargesRate,
            fees: feesRate,
            depotCommission: depotCommissionRate,
            shipping: shippingRates,
            service: shippingService
        };
        return calculateForMode(saleMode, commonData);
    }, [
        recipeItems,
        packagingItems,
        marginMultiplier,
        tvaRate,
        feesRate,
        depotCommissionRate,
        shippingRates,
        saleMode,
        shippingService,
        chargesRate
    ]);

    // Cette fonction peut être utilisée pour recalculer pour tous les modes (utile pour la sauvegarde)
    const calculateAllModes = () => {
        const services = ['Locker', 'Point Relais', 'Domicile'];
        const resultsByMode = {};
        const baseData = {
            recipe: recipeItems, packaging: packagingItems, margin: marginMultiplier,
            tva: tvaRate, charges: chargesRate, fees: feesRate,
            depotCommission: depotCommissionRate, shipping: shippingRates
        };

        resultsByMode['depot'] = calculateForMode('depot', baseData);
        resultsByMode['domicile'] = calculateForMode('domicile', baseData);
        
        services.forEach(service => {
            resultsByMode[service] = calculateForMode('internet', {...baseData, service: service});
        });
        
        return resultsByMode;
    };


    return {
        calculations,
        calculateAllModes
    };
};
