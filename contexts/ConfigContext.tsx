import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAllConfigs, getConfig, getDefaultValue, invalidateCache } from '../lib/configService';

interface ConfigContextType {
  configs: Record<string, string>;
  loading: boolean;
  getConfigValue: (chave: string) => string;
  reloadConfigs: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType>({
  configs: {},
  loading: true,
  getConfigValue: getDefaultValue,
  reloadConfigs: async () => {},
});

export const useConfig = () => useContext(ConfigContext);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const loadConfigs = useCallback(async () => {
    try {
      const allConfigs = await getAllConfigs();
      console.log('[ConfigContext] Configs carregadas. links.url_base_cadastro =', allConfigs['links.url_base_cadastro']);
      setConfigs(allConfigs);
    } catch (error) {
      console.error('[ConfigContext] ERRO ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const getConfigValue = useCallback((chave: string): string => {
    return configs[chave] ?? getDefaultValue(chave);
  }, [configs]);

  const reloadConfigs = useCallback(async () => {
    invalidateCache();
    setLoading(true);
    await loadConfigs();
  }, [loadConfigs]);

  return (
    <ConfigContext.Provider value={{ configs, loading, getConfigValue, reloadConfigs }}>
      {children}
    </ConfigContext.Provider>
  );
};
