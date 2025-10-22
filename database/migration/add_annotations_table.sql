-- Add annotations table to store AI and user annotations
-- This migration adds support for storing annotation data

CREATE TABLE IF NOT EXISTS inspection_annotations (
    id BIGSERIAL PRIMARY KEY,
    inspection_id BIGINT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    annotation_data JSONB NOT NULL, -- Store the complete annotation object
    annotation_type VARCHAR(50) NOT NULL DEFAULT 'Detected by AI', -- 'Detected by AI', 'Edited', 'Manual'
    class_name VARCHAR(100), -- extracted from annotation_data for indexing
    confidence DECIMAL(5,4), -- extracted from annotation_data for indexing
    bounding_box JSONB, -- extracted from annotation_data for indexing
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255), -- user who created/modified this annotation
    notes TEXT -- additional notes for manual annotations
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inspection_annotations_inspection_id ON inspection_annotations(inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspection_annotations_type ON inspection_annotations(annotation_type);
CREATE INDEX IF NOT EXISTS idx_inspection_annotations_class ON inspection_annotations(class_name);
CREATE INDEX IF NOT EXISTS idx_inspection_annotations_created_at ON inspection_annotations(created_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_annotation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_annotation_updated_at
    BEFORE UPDATE ON inspection_annotations
    FOR EACH ROW
    EXECUTE FUNCTION update_annotation_updated_at();

-- Comments for documentation
COMMENT ON TABLE inspection_annotations IS 'Stores AI-detected and user-created/modified annotations for thermal images';
COMMENT ON COLUMN inspection_annotations.annotation_data IS 'Complete annotation object including detection_id, class, confidence, bounding_box, etc.';
COMMENT ON COLUMN inspection_annotations.annotation_type IS 'Type of annotation: Detected by AI, Edited (modified AI detection), or Manual (user-created)';
COMMENT ON COLUMN inspection_annotations.class_name IS 'Extracted class name for indexing (e.g., point_overload_red, loose_joint_yellow)';
COMMENT ON COLUMN inspection_annotations.confidence IS 'Confidence score for AI detections (0.0-1.0), 1.0 for manual annotations';
COMMENT ON COLUMN inspection_annotations.bounding_box IS 'Extracted bounding box data for spatial queries';
COMMENT ON COLUMN inspection_annotations.created_by IS 'Username/ID of the user who created or last modified this annotation';
COMMENT ON COLUMN inspection_annotations.notes IS 'Additional notes, especially for manual annotations';