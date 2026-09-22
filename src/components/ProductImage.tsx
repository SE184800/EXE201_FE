import { useState } from 'react';
import Icon from './Icon';
export default function ProductImage({ url, name }: { url: string | null; name: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <div className="product-image">{url && failedUrl !== url
    ? <img src={url} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
    : <Icon name="box" />}</div>;
}
