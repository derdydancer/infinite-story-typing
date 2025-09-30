import React, { useState, useEffect } from 'react';

interface FloatingPointsProps {
  points: number;
  id: number; // To re-trigger animation on new score
}

const FloatingPoints: React.FC<FloatingPointsProps> = ({ points, id }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (points > 0) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 1500); // Animation duration
      return () => clearTimeout(timer);
    }
  }, [points, id]);

  if (!visible) return null;

  return (
    <div key={id} className="absolute top-4 left-1/2 transform -translate-x-1/2 text-2xl font-bold text-yellow-400 animate-float-up pointer-events-none">
      +{points}
    </div>
  );
};

export default FloatingPoints;
