/** ***************************************************************
* Copyright 2020 Advanced Distributed Learning (ADL)
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
**************************************************************** */
import React from 'react'
import { Link } from 'react-router-dom';

export default function ApiKeyTableRow({ url, apiKey, onRemove, isMember }) {
    function permissions() {
        return [
            apiKey.readPermission ? 'Read' : '',
            apiKey.writePermission ? 'Write' : ''
        ].filter(p => p).join(',');
    }

    return (
        <tr>
            <th width="20%" scope="row">
                { apiKey.description }
            </th>
            <td><span className="font-sans-3xs">{apiKey.uuid}</span></td>
            <td><span className="font-sans-3xs">{permissions()}</span></td>
            <td><span className="font-sans-3xs">{apiKey.isEnabled ? 'Enabled' : 'Disabled'}</span></td>
            { isMember ? <>
                <td>
                    <Link
                            to={`${url}/${apiKey.uuid}/edit`}
                            className="usa-button  usa-button--unstyled">
                        <span className="text-bold">Edit</span>
                    </Link>
                </td>
                <td>
                    <button
                            onClick={() => onRemove(apiKey.uuid)}
                            className="usa-button  usa-button--unstyled">
                        <span className="text-bold">Remove</span>
                    </button>
                </td>
            </> : <><td></td><td></td></>}
        </tr>
    )
}
