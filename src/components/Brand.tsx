import Icon from './Icon';

export default function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? 'brand-light' : ''}`}>
      <span className="brand-mark">
        <Icon name="leaf" />
      </span>
      <span>
        SupplyMind
        <span className="brand-ai">AI</span>
      </span>
    </div>
  );
}
