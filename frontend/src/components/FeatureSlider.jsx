import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Calculator, History, ArrowRight } from 'lucide-react';
import '../styles/FeatureSlider.css';

/**
 * FeatureSlider — Horizontal swipeable card carousel.
 * CSS scroll-snap ensures cards snap perfectly into place.
 * Each card navigates to a route when clicked.
 */

// Feature cards data — easy to extend
const FEATURES = [
  {
    id: 1,
    route: '/',
    icon: LayoutDashboard,
    label: 'Dashboard View',
    description: 'See your full Zakat summary, history timeline, and wealth stats at a glance.',
    accent: '#f59e0b',  /* gold */
  },
  {
    id: 2,
    route: '/current',
    icon: Calculator,
    label: 'Calculate Current Zakat',
    description: 'Enter your savings, gold, and silver to instantly compute this year\'s obligation.',
    accent: '#10b981', /* emerald */
  },
  {
    id: 3,
    route: '/missed',
    icon: History,
    label: 'Calculate Missed Zakat',
    description: 'Step through past Hijri years and catch up on any Zakat you may have missed.',
    accent: '#a78bfa', /* purple */
  },
];

export default function FeatureSlider() {
  return (
    <div className="slider-wrapper">
      {/* Scrollable track */}
      <div className="slider-track">
        {FEATURES.map(({ id, route, icon: Icon, label, description, accent }) => (
          <Link to={route} key={id} className="slider-card" style={{ '--card-accent': accent }}>

            {/* Icon circle */}
            <div className="slider-card__icon">
              <Icon size={24} style={{ color: accent }} />
            </div>

            {/* Text */}
            <div className="slider-card__body">
              <h4 className="slider-card__title">{label}</h4>
              <p className="slider-card__desc">{description}</p>
            </div>

            {/* Arrow */}
            <div className="slider-card__arrow">
              <ArrowRight size={16} style={{ color: accent }} />
            </div>

          </Link>
        ))}
      </div>

      {/* Scroll hint dots */}
      <div className="slider-dots">
        {FEATURES.map((f) => (
          <span key={f.id} className="slider-dot" />
        ))}
      </div>
    </div>
  );
}
