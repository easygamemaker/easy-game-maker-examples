export interface StageData {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly image: string;
  readonly thumb: string;
}

const stage = (id: string, name: string, city: string): StageData => ({
  id,
  name,
  city,
  image: `assets/stages/${id}.webp`,
  thumb: `assets/stages/${id}-thumb.webp`,
});

export const STAGES: readonly StageData[] = [
  stage('pelourinho', 'Pelourinho', 'Salvador'),
  stage('copacabana', 'Copacabana', 'Rio de Janeiro'),
  stage('amazonia', 'Amazon River', 'Amazonas'),
  stage('paulista', 'Avenida Paulista', 'Sao Paulo'),
  stage('sambodromo', 'Sambodromo', 'Rio de Janeiro'),
  stage('pantanal', 'Pantanal', 'Mato Grosso'),
  stage('lencois', 'Lencois Maranhenses', 'Maranhao'),
  stage('corcovado', 'Cristo Redentor', 'Rio de Janeiro'),
  stage('ouropreto', 'Ouro Preto', 'Minas Gerais'),
];

export const getStage = (id: string): StageData => {
  const found = STAGES.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown stage: ${id}`);
  return found;
};
