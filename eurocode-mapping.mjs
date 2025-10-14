// Mapeamento de prefixos Eurocode (primeiros 4 dígitos) para Fabricante e Modelo
// Baseado em dados reais do sistema Parabrisas
// Atualizado: 14 de outubro de 2025

export const EUROCODE_PREFIX_MAP = {
  // BMW
  '2448': { marca: 'BMW', modelo: null }, // Visto no sistema
  
  // Nissan  
  '6001': { marca: 'Nissan', modelo: 'Almera' }, // 6001BLGS - Nissan Almera 95 4P
  
  // Audi
  '8572': { marca: 'Audi', modelo: null }, // 8572LGSS4FDW - Visto no sistema
  
  // Outros (adicionar conforme necessário)
  '3365': { marca: null, modelo: null }, // 3365AGSZ - Visto no sistema
  '6340': { marca: 'Opel', modelo: 'Vivaro' }, // 6340AGAV1C - Opel Vivaro WS
  '7293': { marca: 'Renault', modelo: 'Captur' }, // 7293AGAMV - Renault Captur
  '8193': { marca: 'Tesla', modelo: 'Model Y' }, // 8193AGCHLWZ - Tesla Model Y
  
  // Adicionar mais conforme o sistema for usado
  // Para adicionar novos: copiar os primeiros 4 dígitos do Eurocode e o veículo correspondente
};

/**
 * Obtém informação do veículo a partir do prefixo do Eurocode
 * @param {string} eurocode - Eurocode completo (ex: "2448AGNMV1B")
 * @returns {object|null} - {marca, modelo} ou null se não encontrado
 */
export function getVehicleFromEurocode(eurocode) {
  if (!eurocode || typeof eurocode !== 'string') {
    return null;
  }
  
  // Extrair primeiros 4 dígitos
  const prefixMatch = eurocode.match(/^(\d{4})/);
  if (!prefixMatch) {
    return null;
  }
  
  const prefix = prefixMatch[1];
  const mapping = EUROCODE_PREFIX_MAP[prefix];
  
  if (!mapping) {
    return null;
  }
  
  return {
    marca: mapping.marca,
    modelo: mapping.modelo,
    confianca: 'alta', // Baseado em mapeamento conhecido
    fonte: 'eurocode_prefix'
  };
}

/**
 * Formata o nome completo do veículo
 * @param {string} eurocode - Eurocode completo
 * @returns {string|null} - Nome completo do veículo ou null
 */
export function getVehicleNameFromEurocode(eurocode) {
  const info = getVehicleFromEurocode(eurocode);
  
  if (!info) {
    return null;
  }
  
  if (info.marca && info.modelo) {
    return `${info.marca} ${info.modelo}`;
  }
  
  if (info.marca) {
    return info.marca;
  }
  
  return null;
}

// Exemplo de uso:
// import { getVehicleFromEurocode, getVehicleNameFromEurocode } from './eurocode-mapping.mjs';
// 
// const eurocode = "2448AGNMV1B";
// const vehicle = getVehicleFromEurocode(eurocode);
// console.log(vehicle); // { marca: 'BMW', modelo: null, confianca: 'alta', fonte: 'eurocode_prefix' }
// 
// const name = getVehicleNameFromEurocode(eurocode);
// console.log(name); // "BMW"

