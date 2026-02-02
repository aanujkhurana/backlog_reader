# ADHD Focus Reader

RSVP-based document reader for ADHD professionals to complete work documents without distraction.

## Overview

The ADHD Focus Reader uses Rapid Serial Visual Presentation (RSVP) technology with adaptive pacing to help users with ADHD maintain focus while reading work documents. The system displays one word at a time with optimal recognition point highlighting to reduce cognitive load and eliminate distractions.

## Features

- **Document Processing**: Support for PDF, DOCX, and text input with automatic cleaning
- **RSVP Display**: One-word-at-a-time presentation with adaptive timing
- **Keyboard Controls**: Spacebar pause/resume, arrow key navigation and speed control
- **Progress Persistence**: Automatic position saving with local storage
- **AI Summaries**: Optional section summaries for comprehension confirmation
- **Accessibility**: High contrast display and keyboard-only navigation

## Project Structure

```
src/
├── components/     # Vue components
├── services/       # Business logic and API integrations
├── stores/         # Pinia state management
├── types/          # TypeScript interfaces and type definitions
├── utils/          # Helper functions and utilities
├── views/          # Page-level Vue components
└── router/         # Vue Router configuration
```

## Core Interfaces

The project includes comprehensive TypeScript interfaces for:

- **Document Processing**: PDF/DOCX parsing and text cleaning
- **RSVP Engine**: Word display timing and adaptive pacing
- **Progress Management**: Position saving and resume functionality
- **Keyboard Controls**: Focus-preserving input handling
- **AI Summaries**: Section confirmation generation

## Dependencies

- **Vue 3** with TypeScript and Vite for fast development
- **pdf-parse** for PDF document processing
- **mammoth** for DOCX document conversion
- **fast-check** for property-based testing
- **Vitest** for unit testing
- **Pinia** for state management
- **Vue Router** for navigation

## Development Setup

```sh
# Install dependencies
npm install

# Start development server
npm run dev

# Run type checking
npm run type-check

# Run tests
npm run test:unit

# Run linting
npm run lint

# Build for production
npm run build
```

## Requirements Validation

This setup validates the following requirements:

- **1.1**: Document upload and processing infrastructure
- **1.2**: Text cleaning and structure preservation
- **1.3**: Multiple input format support (PDF, DOCX, text)

## Next Steps

1. Implement document processing service (Task 2)
2. Build RSVP engine with adaptive pacing (Task 3)
3. Create keyboard control system (Task 4)
4. Add progress management and local storage (Task 5)