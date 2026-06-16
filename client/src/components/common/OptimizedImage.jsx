// client/src/components/common/OptimizedImage.jsx
import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

export default function OptimizedImage({
  src,
  alt,
  className = '',
  width,
  height,
  lazy = true,
  fallback = '/placeholder.png',
  onLoad,
  onError
}) {
  const [imageSrc, setImageSrc] = useState(lazy ? fallback : src);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!lazy || !src) return;

    // Intersection Observer for lazy loading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setImageSrc(src);
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [src, lazy]);

  const handleLoad = (e) => {
    setIsLoaded(true);
    if (onLoad) onLoad(e);
  };

  const handleError = (e) => {
    setHasError(true);
    setImageSrc(fallback);
    if (onError) onError(e);
  };

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={className}
      width={width}
      height={height}
      onLoad={handleLoad}
      onError={handleError}
      style={{
        opacity: isLoaded && !hasError ? 1 : 0.5,
        transition: 'opacity 0.3s ease'
      }}
      loading={lazy ? 'lazy' : 'eager'}
    />
  );
}

OptimizedImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  className: PropTypes.string,
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  lazy: PropTypes.bool,
  fallback: PropTypes.string,
  onLoad: PropTypes.func,
  onError: PropTypes.func
};
