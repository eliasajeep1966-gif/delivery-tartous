import {
  Text,
  TextInput,
  type StyleProp,
  type TextStyle,
} from "react-native";

const CAIRO_REGULAR = "Cairo_400Regular";

type ComponentWithDefaultStyle = {
  defaultProps?: {
    style?: StyleProp<TextStyle>;
  };
};

function applyDefaultFont(component: ComponentWithDefaultStyle) {
  component.defaultProps = {
    ...component.defaultProps,
    style: [{ fontFamily: CAIRO_REGULAR }, component.defaultProps?.style ?? {}],
  };
}

applyDefaultFont(Text as ComponentWithDefaultStyle);
applyDefaultFont(TextInput as ComponentWithDefaultStyle);
