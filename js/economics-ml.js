/**
 * Economics ML Module — Client-side predictive analytics engine
 * 
 * Implements:
 * - Linear Regression (least-squares) for trend extrapolation
 * - Weighted Moving Average (WMA) for smoothed short-term predictions
 * - Confidence Intervals (standard error-based 80%/95% bands)
 * - Model Accuracy metrics (R², MAE, MAPE)
 * - Combined prediction blending (70% regression + 30% WMA)
 * 
 * All formulas follow standard econometrics:
 *   y = β₀ + β₁x  where  β₁ = Σ(xᵢ−x̄)(yᵢ−ȳ) / Σ(xᵢ−x̄)²
 *   WMA: ŷ = Σ(wᵢ × yᵢ) / Σwᵢ  with linearly decaying weights
 *   CI:  ŷ ± z × SE  where SE = σ/√n
 */

import EconomicsAnalytics from './economics-analytics.js';

const EconomicsML = {

    // ===== CORE LINEAR REGRESSION =====

    /**
     * Fit a simple linear regression model: y = β₀ + β₁x
     * Uses ordinary least squares (OLS)
     * 
     * @param {number[]} x - Independent variable values (e.g., month indices)
     * @param {number[]} y - Dependent variable values (e.g., revenue amounts)
     * @returns {Object} { slope, intercept, rSquared, standardError, residuals }
     */
    fitLinearRegression(x, y) {
        const n = x.length;
        if (n < 2) return { slope: 0, intercept: y[0] || 0, rSquared: 0, standardError: 0, residuals: [] };

        // Calculate means
        const xMean = x.reduce((s, v) => s + v, 0) / n;
        const yMean = y.reduce((s, v) => s + v, 0) / n;

        // Calculate slope: β₁ = Σ(xᵢ−x̄)(yᵢ−ȳ) / Σ(xᵢ−x̄)²
        let numerator = 0;
        let denominator = 0;
        for (let i = 0; i < n; i++) {
            numerator += (x[i] - xMean) * (y[i] - yMean);
            denominator += (x[i] - xMean) ** 2;
        }

        const slope = denominator !== 0 ? numerator / denominator : 0;
        const intercept = yMean - slope * xMean;

        // Calculate residuals and R²
        const residuals = [];
        let ssRes = 0; // Sum of squared residuals
        let ssTot = 0; // Total sum of squares
        for (let i = 0; i < n; i++) {
            const predicted = intercept + slope * x[i];
            const residual = y[i] - predicted;
            residuals.push(residual);
            ssRes += residual ** 2;
            ssTot += (y[i] - yMean) ** 2;
        }

        const rSquared = ssTot !== 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

        // Standard error of the estimate
        const standardError = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;

        return { slope, intercept, rSquared, standardError, residuals, n };
    },

    /**
     * Predict future values using the fitted regression model
     * @param {Object} model - Fitted model from fitLinearRegression
     * @param {number[]} futureX - X values to predict for
     * @returns {Object[]} Array of { x, predicted, lower80, upper80, lower95, upper95 }
     */
    predictFromRegression(model, futureX) {
        // z-scores: 80% CI = 1.282, 95% CI = 1.960
        const z80 = 1.282;
        const z95 = 1.960;

        return futureX.map(xi => {
            const predicted = model.intercept + model.slope * xi;
            const margin80 = z80 * model.standardError;
            const margin95 = z95 * model.standardError;

            return {
                x: xi,
                predicted: Math.max(0, Math.round(predicted * 100) / 100),
                lower80: Math.max(0, Math.round((predicted - margin80) * 100) / 100),
                upper80: Math.max(0, Math.round((predicted + margin80) * 100) / 100),
                lower95: Math.max(0, Math.round((predicted - margin95) * 100) / 100),
                upper95: Math.max(0, Math.round((predicted + margin95) * 100) / 100)
            };
        });
    },

    // ===== WEIGHTED MOVING AVERAGE =====

    /**
     * Calculate weighted moving average prediction
     * More recent observations get higher weights (linearly decaying)
     * 
     * WMA formula: ŷ = Σ(wᵢ × yᵢ) / Σwᵢ  where wᵢ = n - i + 1
     * 
     * @param {number[]} values - Historical values
     * @param {number} window - Window size (default 3)
     * @returns {number} Predicted next value
     */
    weightedMovingAverage(values, window = 3) {
        if (values.length === 0) return 0;
        const len = Math.min(window, values.length);
        const recent = values.slice(-len);

        let weightedSum = 0;
        let totalWeight = 0;

        for (let i = 0; i < recent.length; i++) {
            const weight = i + 1; // Linear increasing weights (most recent = highest)
            weightedSum += recent[i] * weight;
            totalWeight += weight;
        }

        return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
    },

    /**
     * Predict multiple future values using WMA with trend adjustment
     * @param {number[]} values - Historical values
     * @param {number} periods - Number of future periods to predict
     * @returns {number[]} Predicted values
     */
    wmaForecast(values, periods = 3) {
        if (values.length < 2) return Array(periods).fill(values[0] || 0);

        const predictions = [...values];
        for (let i = 0; i < periods; i++) {
            const next = this.weightedMovingAverage(predictions, 3);
            // Add slight trend continuation
            const trend = predictions.length >= 2
                ? (predictions[predictions.length - 1] - predictions[predictions.length - 2]) * 0.3
                : 0;
            predictions.push(Math.max(0, Math.round((next + trend) * 100) / 100));
        }

        return predictions.slice(-periods);
    },

    // ===== MODEL ACCURACY METRICS =====

    /**
     * Calculate Mean Absolute Error (MAE)
     * MAE = (1/n) × Σ|yᵢ − ŷᵢ|
     */
    calculateMAE(actual, predicted) {
        if (actual.length === 0) return 0;
        const sum = actual.reduce((s, a, i) => s + Math.abs(a - (predicted[i] || 0)), 0);
        return Math.round((sum / actual.length) * 100) / 100;
    },

    /**
     * Calculate Mean Absolute Percentage Error (MAPE)
     * MAPE = (100/n) × Σ|yᵢ − ŷᵢ| / |yᵢ|
     */
    calculateMAPE(actual, predicted) {
        const validPairs = actual.map((a, i) => [a, predicted[i] || 0]).filter(([a]) => a !== 0);
        if (validPairs.length === 0) return 0;

        const sum = validPairs.reduce((s, [a, p]) => s + Math.abs(a - p) / Math.abs(a), 0);
        return Math.round((sum / validPairs.length) * 100 * 100) / 100; // As percentage
    },

    /**
     * Holdout validation: use last 20% of data as test set
     * Falls back to training-set metrics if dataset is too small for holdout
     */
    validateModel(x, y) {
        const fullModel = this.fitLinearRegression(x, y);

        // If data is too small for meaningful holdout, use full set training metrics
        if (x.length < 5) {
            const predictions = this.predictFromRegression(fullModel, x);
            const predictedValues = predictions.map(p => p.predicted);
            const mape = this.calculateMAPE(y, predictedValues);

            return {
                rSquared: Math.round(fullModel.rSquared * 1000) / 1000,
                mae: this.calculateMAE(y, predictedValues),
                mape: Math.min(100, mape),
                reliable: false,
                isTrainingOnly: true,
                reason: 'Insufficient data for holdout (need ≥5 months)'
            };
        }

        const splitIdx = Math.floor(x.length * 0.8);
        const trainX = x.slice(0, splitIdx);
        const trainY = y.slice(0, splitIdx);
        const testX = x.slice(splitIdx);
        const testY = y.slice(splitIdx);

        const model = this.fitLinearRegression(trainX, trainY);
        const predictions = this.predictFromRegression(model, testX);
        const predictedValues = predictions.map(p => p.predicted);

        const mae = this.calculateMAE(testY, predictedValues);
        const mape = this.calculateMAPE(testY, predictedValues);

        return {
            rSquared: Math.round(model.rSquared * 1000) / 1000,
            mae,
            mape: Math.min(100, mape),
            reliable: model.rSquared > 0.3 && mape < 50,
            isTrainingOnly: false,
            reason: model.rSquared <= 0.3 ? 'Low R² — high variance in data'
                : mape >= 50 ? 'High prediction error — volatile data'
                    : 'Model fits well within acceptable bounds'
        };
    },

    // ===== BLENDED PREDICTIONS =====

    /**
     * Blend regression and WMA predictions
     * Uses 70% regression + 30% WMA for balanced forecasting
     * 
     * @param {number[]} historicalValues - Historical time series values
     * @param {number} forecastPeriods - Number of future periods
     * @returns {Object} Complete prediction result
     */
    blendedForecast(historicalValues, forecastPeriods = 3) {
        if (historicalValues.length < 2) {
            const val = historicalValues[0] || 0;
            return {
                predictions: Array(forecastPeriods).fill({
                    predicted: val, lower80: val, upper80: val, lower95: val, upper95: val
                }),
                model: { rSquared: 0, standardError: 0 },
                accuracy: { rSquared: 0, mae: 0, mape: 0, reliable: false, reason: 'Insufficient data' }
            };
        }

        const x = historicalValues.map((_, i) => i);
        const y = historicalValues;

        // Fit regression
        const model = this.fitLinearRegression(x, y);
        const futureX = Array.from({ length: forecastPeriods }, (_, i) => x.length + i);
        const regressionPreds = this.predictFromRegression(model, futureX);

        // Get WMA predictions
        const wmaPreds = this.wmaForecast(historicalValues, forecastPeriods);

        // Blend: 70% regression + 30% WMA
        const blended = regressionPreds.map((rp, i) => {
            const blendedValue = Math.max(0, Math.round((rp.predicted * 0.7 + wmaPreds[i] * 0.3) * 100) / 100);
            const shift = blendedValue - rp.predicted;

            return {
                predicted: blendedValue,
                regressionValue: rp.predicted,
                wmaValue: wmaPreds[i],
                lower80: Math.max(0, Math.round((rp.lower80 + shift) * 100) / 100),
                upper80: Math.max(0, Math.round((rp.upper80 + shift) * 100) / 100),
                lower95: Math.max(0, Math.round((rp.lower95 + shift) * 100) / 100),
                upper95: Math.max(0, Math.round((rp.upper95 + shift) * 100) / 100)
            };
        });

        // Accuracy using holdout
        const accuracy = this.validateModel(x, y);

        return { predictions: blended, model, accuracy };
    },

    // ===== HIGH-LEVEL PREDICTION API =====

    /**
     * Get comprehensive revenue predictions
     * @param {number} months - Number of months to forecast (default 3)
     * @returns {Object} { historical, predictions, accuracy, trend }
     */
    async predictRevenue(months = 3) {
        const trend = await EconomicsAnalytics.getMonthlyRevenueTrend();
        if (!trend || trend.length === 0) {
            return this._emptyPrediction('revenue', months);
        }

        const values = trend.map(t => t.revenue);
        const labels = trend.map(t => t.month);
        const forecast = this.blendedForecast(values, months);

        // Generate future labels
        const lastDate = this._parseMonthLabel(labels[labels.length - 1]);
        const futureLabels = [];
        for (let i = 1; i <= months; i++) {
            const fDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + i, 1);
            futureLabels.push(`${fDate.getFullYear()}-${String(fDate.getMonth() + 1).padStart(2, '0')}`);
        }

        // Calculate trend direction
        const recentSlope = values.length >= 2
            ? values[values.length - 1] - values[values.length - 2]
            : 0;
        const trendDirection = recentSlope > 0 ? 'upward' : recentSlope < 0 ? 'downward' : 'flat';

        return {
            metric: 'revenue',
            historical: { labels, values },
            predictions: forecast.predictions.map((p, i) => ({ ...p, label: futureLabels[i] })),
            accuracy: forecast.accuracy,
            model: forecast.model,
            trend: trendDirection,
            currentValue: values[values.length - 1],
            predictedNextValue: forecast.predictions[0]?.predicted || 0,
            changePercent: values[values.length - 1] > 0
                ? Math.round(((forecast.predictions[0]?.predicted || 0) - values[values.length - 1]) / values[values.length - 1] * 100 * 10) / 10
                : 0
        };
    },

    /**
     * Get comprehensive cost predictions
     */
    async predictCosts(months = 3) {
        const trend = await EconomicsAnalytics.getMonthlyCostTrend();
        if (!trend || trend.length === 0) {
            return this._emptyPrediction('costs', months);
        }

        const values = trend.map(t => t.cost);
        const labels = trend.map(t => t.month);
        const forecast = this.blendedForecast(values, months);

        const lastDate = this._parseMonthLabel(labels[labels.length - 1]);
        const futureLabels = [];
        for (let i = 1; i <= months; i++) {
            const fDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + i, 1);
            futureLabels.push(`${fDate.getFullYear()}-${String(fDate.getMonth() + 1).padStart(2, '0')}`);
        }

        const recentSlope = values.length >= 2
            ? values[values.length - 1] - values[values.length - 2]
            : 0;

        return {
            metric: 'costs',
            historical: { labels, values },
            predictions: forecast.predictions.map((p, i) => ({ ...p, label: futureLabels[i] })),
            accuracy: forecast.accuracy,
            model: forecast.model,
            trend: recentSlope > 0 ? 'upward' : recentSlope < 0 ? 'downward' : 'flat',
            currentValue: values[values.length - 1],
            predictedNextValue: forecast.predictions[0]?.predicted || 0,
            changePercent: values[values.length - 1] > 0
                ? Math.round(((forecast.predictions[0]?.predicted || 0) - values[values.length - 1]) / values[values.length - 1] * 100 * 10) / 10
                : 0
        };
    },

    /**
     * Get comprehensive margin predictions
     */
    async predictMargins(months = 3) {
        const trend = await EconomicsAnalytics.getMarginTrend();
        if (!trend || trend.length === 0) {
            return this._emptyPrediction('margins', months);
        }

        const values = trend.map(t => t.margin);
        const labels = trend.map(t => t.month);
        const forecast = this.blendedForecast(values, months);

        const lastDate = this._parseMonthLabel(labels[labels.length - 1]);
        const futureLabels = [];
        for (let i = 1; i <= months; i++) {
            const fDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + i, 1);
            futureLabels.push(`${fDate.getFullYear()}-${String(fDate.getMonth() + 1).padStart(2, '0')}`);
        }

        // Clamp margin predictions to 0-100
        forecast.predictions.forEach(p => {
            p.predicted = Math.max(0, Math.min(100, p.predicted));
            p.lower80 = Math.max(0, Math.min(100, p.lower80));
            p.upper80 = Math.max(0, Math.min(100, p.upper80));
            p.lower95 = Math.max(0, Math.min(100, p.lower95));
            p.upper95 = Math.max(0, Math.min(100, p.upper95));
        });

        const recentSlope = values.length >= 2
            ? values[values.length - 1] - values[values.length - 2]
            : 0;

        return {
            metric: 'margins',
            historical: { labels, values },
            predictions: forecast.predictions.map((p, i) => ({ ...p, label: futureLabels[i] })),
            accuracy: forecast.accuracy,
            model: forecast.model,
            trend: recentSlope > 0 ? 'upward' : recentSlope < 0 ? 'downward' : 'flat',
            currentValue: values[values.length - 1],
            predictedNextValue: forecast.predictions[0]?.predicted || 0,
            changePercent: values[values.length - 1] > 0
                ? Math.round(((forecast.predictions[0]?.predicted || 0) - values[values.length - 1]) / values[values.length - 1] * 100 * 10) / 10
                : 0
        };
    },

    /**
     * Get predicted valuation based on forecasted revenue
     */
    async predictValuation(months = 3) {
        const revenuePred = await this.predictRevenue(months);
        const currentValuation = await EconomicsAnalytics.getValuationScenarios();

        // Predict future annualized revenue
        const predictedMonthlyRevenue = revenuePred.predictions[revenuePred.predictions.length - 1]?.predicted || 0;
        const predictedAnnualRevenue = predictedMonthlyRevenue * 12;

        // Apply standard construction multiples
        const predictedValuation = {
            conservative: Math.round(predictedAnnualRevenue * 2.5),
            base: Math.round(predictedAnnualRevenue * 3.25),
            aggressive: Math.round(predictedAnnualRevenue * 4.0)
        };

        return {
            current: currentValuation.blended,
            predicted: predictedValuation,
            change: {
                conservative: predictedValuation.conservative - (currentValuation.blended.conservative || 0),
                base: predictedValuation.base - (currentValuation.blended.base || 0),
                aggressive: predictedValuation.aggressive - (currentValuation.blended.aggressive || 0)
            },
            revenueForecasted: revenuePred
        };
    },

    /**
     * Get full comprehensive prediction summary
     * This is the main entry point for the predictions tab
     */
    async getComprehensivePredictions(months = 3) {
        const [revenue, costs, margins, valuation] = await Promise.all([
            this.predictRevenue(months),
            this.predictCosts(months),
            this.predictMargins(months),
            this.predictValuation(months)
        ]);

        // Calculate predicted profit
        const predictedRevenue = revenue.predictedNextValue;
        const predictedCosts = costs.predictedNextValue;
        const predictedProfit = Math.max(0, predictedRevenue - predictedCosts);

        // Risk score: 0-100 (lower = riskier)
        const avgReliability = [revenue, costs, margins].filter(m => m.accuracy.reliable).length;
        const avgRSquared = (revenue.accuracy.rSquared + costs.accuracy.rSquared + margins.accuracy.rSquared) / 3;
        const riskScore = Math.round(
            (avgReliability / 3) * 40 +
            avgRSquared * 40 +
            (revenue.trend === 'upward' ? 20 : revenue.trend === 'flat' ? 10 : 0)
        );

        // Data quality score
        const dataPoints = revenue.historical.values.length;
        const dataQuality = dataPoints >= 12 ? 'Excellent' : dataPoints >= 6 ? 'Good' : dataPoints >= 3 ? 'Fair' : 'Limited';

        return {
            revenue,
            costs,
            margins,
            valuation,
            predictedProfit,
            riskScore: Math.min(100, Math.max(0, riskScore)),
            dataQuality,
            dataPoints,
            generatedAt: new Date().toISOString()
        };
    },

    // ===== UTILITY HELPERS =====

    _parseMonthLabel(label) {
        const [year, month] = label.split('-').map(Number);
        return new Date(year, month - 1, 1);
    },

    _emptyPrediction(metric, months) {
        return {
            metric,
            historical: { labels: [], values: [] },
            predictions: Array(months).fill({
                predicted: 0, lower80: 0, upper80: 0, lower95: 0, upper95: 0, label: ''
            }),
            accuracy: { rSquared: 0, mae: 0, mape: 0, reliable: false, reason: 'No historical data available' },
            model: { rSquared: 0, standardError: 0 },
            trend: 'flat',
            currentValue: 0,
            predictedNextValue: 0,
            changePercent: 0
        };
    }
};

// Make globally accessible
if (typeof window !== 'undefined') {
    window.EconomicsML = EconomicsML;
}

export default EconomicsML;
