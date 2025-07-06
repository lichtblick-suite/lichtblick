import { AllowedFileExtensions } from "@lichtblick/suite-base/constants/allowedFileExtensions";
import { IDataSourceFactory, DataSourceFactoryInitializeArgs } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { Player } from "@lichtblick/suite-base/players/types";
export declare function checkExtensionMatch(fileExtension: string, previousExtension?: string): string;
declare class RemoteDataSourceFactory implements IDataSourceFactory {
    #private;
    id: string;
    legacyIds: string[];
    type: IDataSourceFactory["type"];
    displayName: string;
    iconName: IDataSourceFactory["iconName"];
    supportedFileTypes: AllowedFileExtensions[];
    description: string;
    docsLinks: {
        label: string;
        url: string;
    }[];
    formConfig: {
        fields: {
            id: string;
            label: string;
            placeholder: string;
            validate: (newValue: string) => Error | undefined;
        }[];
    };
    warning: import("react/jsx-runtime").JSX.Element;
    initialize(args: DataSourceFactoryInitializeArgs): Player | undefined;
}
export default RemoteDataSourceFactory;
